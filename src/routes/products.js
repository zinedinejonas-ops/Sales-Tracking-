import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/', requireAuth, async (req, res) => {
  const search = String(req.query.search || '').trim()
  const sort = String(req.query.sort || 'recent')
  try {
    const params = []
    let where = '1=1'
    if (search) {
      where = 'name LIKE ?'
      params.push(`%${search}%`)
    }
    let order = 'created_at DESC'
    if (sort === 'alpha') order = 'name ASC'
    let sql
    if (req.user && req.user.role === 'seller') {
      const shopId = Number(req.user.shopId || 0)
      sql = `
        SELECT p.id, p.sku, p.name, p.unit, p.sell_price, p.created_at, p.active,
               COALESCE(st.on_hand,0) AS on_hand, COALESCE(st.sold_count,0) AS sold_count
        FROM products p
        LEFT JOIN stock st ON st.product_id = p.id AND st.shop_id = ?
        WHERE ${where}
        ORDER BY ${order}
        LIMIT 200
      `
      params.unshift(shopId)
    } else {
      sql = `
        SELECT id, sku, name, unit, sell_price, created_at, active, total_stock
        FROM products
        WHERE ${where}
        ORDER BY ${order}
        LIMIT 200
      `
    }
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { sku, name, category, cost_price, sell_price, tax_rate, active } = req.body
  if (!sku || !name) return res.status(400).json({ error: 'missing_fields' })
  try {
    await query(
      `INSERT INTO products (sku, name, category, cost_price, sell_price, tax_rate, active)
       VALUES (?,?,?,?,?,?,COALESCE(?, 1))`,
      [sku, name, category || null, cost_price || 0, sell_price || 0, tax_rate || 0, active ? 1 : 1]
    )
    const { rows } = await query(
      `SELECT id, sku, name, category, cost_price, sell_price, tax_rate, active FROM products WHERE sku=?`,
      [sku]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/register', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, unit, cost_price, sell_price, selling_price, initial_stock } = req.body
  const finalSell = typeof selling_price !== 'undefined' ? selling_price : sell_price
  if (!name || !unit || typeof finalSell === 'undefined' || typeof cost_price === 'undefined') {
    return res.status(400).json({ error: 'missing_fields' })
  }
  const stock = Number(initial_stock) || 0
  try {
    const sku = ('SKU-' + name).replace(/\s+/g, '-').toUpperCase().slice(0, 32)
    await query(
      `INSERT INTO products (sku, name, unit, cost_price, sell_price, tax_rate, active, created_at, total_stock)
       VALUES (?,?,?,?,?,0,1, NOW(), ?)`,
      [sku, name, unit, Number(cost_price), Number(finalSell), stock]
    )
    const { rows } = await query(
      `SELECT id, sku, name, unit, cost_price, sell_price, created_at, total_stock FROM products WHERE sku=?`,
      [sku]
    )
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { name, category, cost_price, sell_price, selling_price, tax_rate, active } = req.body
  const finalSell = typeof selling_price !== 'undefined' ? selling_price : sell_price
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    await query(
      `UPDATE products
       SET name=COALESCE(?,name),
           category=?,
           cost_price=COALESCE(?,cost_price),
           sell_price=COALESCE(?,sell_price),
           tax_rate=COALESCE(?,tax_rate),
           active=COALESCE(?,active)
       WHERE id=?`,
      [name || null, category || null, cost_price, finalSell, tax_rate, typeof active === 'boolean' ? (active ? 1 : 0) : null, id]
    )
    const { rows } = await query(
      `SELECT id, sku, name, category, cost_price, sell_price, tax_rate, active FROM products WHERE id=?`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/:id/add-stock', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { quantity } = req.body
  if (!id || !quantity || quantity <= 0) return res.status(400).json({ error: 'invalid_fields' })
  try {
    await query(`UPDATE products SET total_stock = COALESCE(total_stock, 0) + ? WHERE id=?`, [quantity, id])
    const { rows } = await query(`SELECT id, total_stock FROM products WHERE id=?`, [id])
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    const { rows: salesRows } = await query(`SELECT COUNT(*) AS cnt FROM sales WHERE product_id=?`, [id])
    if (Number(salesRows[0].cnt) > 0) return res.status(409).json({ error: 'product_has_sales' })

    const { rows: stockRows } = await query(`SELECT COUNT(*) AS cnt FROM stock WHERE product_id=? AND on_hand > 0`, [id])
    if (Number(stockRows[0].cnt) > 0) return res.status(409).json({ error: 'product_has_stock_in_shops' })

    await query(`DELETE FROM products WHERE id=?`, [id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
