import express from 'express'
import { query } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/', requireAuth, async (req, res) => {
  const search = String(req.query.search || '').trim()
  const sort = String(req.query.sort || 'recent')
  try {
    const params = []
    // Determine if user is seller to set up params order
    const isSeller = req.user && req.user.role === 'seller'
    let shopIdIdx = 0
    
    if (isSeller) {
      params.push(Number(req.user.shopId || 0))
      shopIdIdx = params.length
    }

    let where = '1=1'
    if (search) {
      params.push(`%${search}%`)
      where = `name LIKE $${params.length}`
    }

    let order = 'created_at DESC'
    if (sort === 'alpha') order = 'name ASC'
    
    let sql
    if (isSeller) {
      sql = `
        SELECT p.id, p.sku, p.name, p.unit, p.sell_price, p.created_at, p.active,
               COALESCE(st.on_hand,0) AS on_hand, COALESCE(st.sold_count,0) AS sold_count
        FROM products p
        LEFT JOIN stock st ON st.product_id = p.id AND st.shop_id = $${shopIdIdx}
        WHERE ${where}
        ORDER BY ${order}
        LIMIT 200
      `
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
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { sku, name, category, cost_price, sell_price, tax_rate, active } = req.body
  if (!sku || !name) return res.status(400).json({ error: 'missing_fields' })
  try {
    await query(
      `INSERT INTO products (sku, name, category, cost_price, sell_price, tax_rate, active)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, true))`,
      [sku, name, category || null, cost_price || 0, sell_price || 0, tax_rate || 0, true]
    )
    const { rows } = await query(
      `SELECT id, sku, name, category, cost_price, sell_price, tax_rate, active FROM products WHERE sku=$1`,
      [sku]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
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
       VALUES ($1,$2,$3,$4,$5,0,true, NOW(), $6)`,
      [sku, name, unit, Number(cost_price), Number(finalSell), stock]
    )
    const { rows } = await query(
      `SELECT id, sku, name, unit, cost_price, sell_price, created_at, total_stock FROM products WHERE sku=$1`,
      [sku]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
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
       SET name=COALESCE($1,name),
           category=$2,
           cost_price=COALESCE($3,cost_price),
           sell_price=COALESCE($4,sell_price),
           tax_rate=COALESCE($5,tax_rate),
           active=COALESCE($6,active)
       WHERE id=$7`,
      [name || null, category || null, cost_price, finalSell, tax_rate, typeof active === 'boolean' ? active : null, id]
    )
    const { rows } = await query(
      `SELECT id, sku, name, category, cost_price, sell_price, tax_rate, active FROM products WHERE id=$1`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/:id/add-stock', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { quantity } = req.body
  if (!id || !quantity || quantity <= 0) return res.status(400).json({ error: 'invalid_fields' })
  try {
    await query(`UPDATE products SET total_stock = COALESCE(total_stock, 0) + $1 WHERE id=$2`, [quantity, id])
    const { rows } = await query(`SELECT id, total_stock FROM products WHERE id=$1`, [id])
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    // Changed sales to sale_items as sales table does not have product_id
    const { rows: salesRows } = await query(`SELECT COUNT(*) AS cnt FROM sale_items WHERE product_id=$1`, [id])
    if (Number(salesRows[0].cnt) > 0) return res.status(409).json({ error: 'product_has_sales' })

    const { rows: stockRows } = await query(`SELECT COUNT(*) AS cnt FROM stock WHERE product_id=$1 AND on_hand > 0`, [id])
    if (Number(stockRows[0].cnt) > 0) return res.status(409).json({ error: 'product_has_stock_in_shops' })

    await query(`DELETE FROM products WHERE id=$1`, [id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
