import express from 'express'
import { query, transaction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/shops/:shopId', requireAuth, async (req, res) => {
  const shopId = Number(req.params.shopId)
  if (!shopId) return res.status(400).json({ error: 'invalid_id' })
  try {
    const { rows: shop } = await query(`SELECT id, name FROM shops WHERE id=?`, [shopId])
    if (!shop.length) return res.status(404).json({ error: 'shop_not_found' })
    
    const { rows: stock } = await query(
      `SELECT COUNT(*) as count, SUM(on_hand) as total_items, SUM(on_hand * p.sell_price) as total_value
       FROM stock s
       JOIN products p ON p.id = s.product_id
       WHERE s.shop_id=?`,
      [shopId]
    )
    res.json({ ...shop[0], total_items: Number(stock[0].total_items || 0), total_value: Number(stock[0].total_value || 0) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/shops/:shopId/products/:productId', requireAuth, async (req, res) => {
  const shopId = Number(req.params.shopId)
  const productId = Number(req.params.productId)
  if (!shopId || !productId) return res.status(400).json({ error: 'invalid_fields' })
  if (req.user.role === 'seller' && Number(req.user.shopId || 0) !== shopId) {
    return res.status(403).json({ error: 'forbidden_shop' })
  }
  try {
    const { rows } = await query(`SELECT on_hand, COALESCE(sold_count, 0) AS sold_count FROM stock WHERE shop_id=? AND product_id=?`, [shopId, productId])
    res.json({ on_hand: rows.length ? Number(rows[0].on_hand) : 0, sold_count: rows.length ? Number(rows[0].sold_count || 0) : 0 })
  } catch (err) {
    console.error('Stock API Error:', err)
    res.status(500).json({ error: 'server_error' })
  }
})

// Get all products with stock info for a specific shop
router.get('/shops/:shopId/products', requireAuth, async (req, res) => {
  const shopId = Number(req.params.shopId)
  if (!shopId) return res.status(400).json({ error: 'invalid_fields' })
  if (req.user.role === 'seller' && Number(req.user.shopId || 0) !== shopId) {
    return res.status(403).json({ error: 'forbidden_shop' })
  }
  try {
    let sql = `
      SELECT p.id, p.name, p.unit, p.sell_price, p.total_stock, p.created_at,
             COALESCE(s.on_hand, 0) as on_hand,
             COALESCE(s.sold_count, 0) as sold_count
    FROM products p
    LEFT JOIN stock s ON s.product_id = p.id AND s.shop_id = ?
    `
    if (req.user.role === 'seller') {
      sql += ` WHERE s.product_id IS NOT NULL `
    }
    sql += ` ORDER BY p.name ASC`

    const { rows } = await query(sql, [shopId])
    res.json(rows)
  } catch (err) {
    console.error('Products Fetch Error:', err)
    res.status(500).json({ error: 'server_error: ' + err.message })
  }
})

// Transfer stock from admin pool to shop stock
router.post('/shops/:shopId/products/:productId/add', requireAuth, async (req, res) => {
  const shopId = Number(req.params.shopId)
  const productId = Number(req.params.productId)
  const { quantity } = req.body
  if (!shopId || !productId || !Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'invalid_fields' })
  if (req.user.role === 'seller' && Number(req.user.shopId || 0) !== shopId) {
    return res.status(403).json({ error: 'forbidden_shop' })
  }

  try {
    const result = await transaction(async (client) => {
      // 1. Check and Deduct from Main Store (Admin)
      const { rows: check } = await client.query('SELECT total_stock FROM products WHERE id=?', [productId])
      if (!check.length) throw new Error('product_not_found')
      if ((check[0].total_stock || 0) < quantity) throw new Error('insufficient_store_stock')

      await client.query(`UPDATE products SET total_stock = total_stock - ? WHERE id=?`, [quantity, productId])
      
      // 2. Add to Shop Stock
      const upsert = `
        INSERT INTO stock (shop_id, product_id, on_hand, reorder_level, sold_count, updated_at)
        VALUES (?,?,?,?,0, NOW())
        ON DUPLICATE KEY UPDATE on_hand = COALESCE(on_hand, 0) + VALUES(on_hand), updated_at = NOW()
      `
      await client.query(upsert, [shopId, productId, quantity, 0])
      
      // 3. Return updated stock
      const { rows } = await client.query(
        `SELECT shop_id, product_id, on_hand, COALESCE(sold_count,0) AS sold_count FROM stock WHERE shop_id=? AND product_id=?`,
        [shopId, productId]
      )
      return rows[0]
    })
    
    res.json(result)
  } catch (err) {
    console.error('Stock Add Error:', err)
    if (err.message === 'insufficient_store_stock') return res.status(400).json({ error: 'insufficient_store_stock' })
    res.status(500).json({ error: 'server_error: ' + err.message })
  }
})

// Product stock summary across shops
router.get('/products/:productId/summary', requireAuth, async (req, res) => {
  const productId = Number(req.params.productId)
  if (!productId) return res.status(400).json({ error: 'invalid_fields' })
  try {
    const { rows: perShop } = await query(
      `SELECT sh.id AS shop_id, sh.name AS shop_name, COALESCE(st.on_hand, 0) AS on_hand
       FROM shops sh
       LEFT JOIN stock st ON st.shop_id = sh.id AND st.product_id = ?
       ORDER BY sh.name ASC`,
      [productId]
    )
    const total = perShop.reduce((sum, r) => sum + Number(r.on_hand || 0), 0)
    res.json({ total_on_hand: total, shops: perShop })
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
