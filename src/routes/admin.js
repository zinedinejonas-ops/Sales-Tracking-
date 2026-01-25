import express from 'express'
import { query, transaction } from '../db.js'
import bcrypt from 'bcryptjs'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/sellers', requireAuth, requireRole('admin'), async (req, res) => {
  const search = String(req.query.search || '').trim()
  const shopId = req.query.shopId ? Number(req.query.shopId) : null
  const params = []
  let where = "role='seller'"
  if (search) {
    params.push(`%${search}%`)
    where += ` AND name LIKE $${params.length}`
  }
  if (shopId) {
    params.push(shopId)
    where += ` AND shop_id = $${params.length}`
  }
  try {
    const { rows } = await query(
      `SELECT id, name, email, contact, shop_id, active, created_at
       FROM users
       WHERE ${where}
       ORDER BY name ASC
       LIMIT 200`,
      params
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/sellers', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, contact, email, shop_id, passkey } = req.body
  if (!name || !contact || !email || !passkey || !shop_id) return res.status(400).json({ error: 'missing_fields' })
  try {
    const hash = await bcrypt.hash(passkey, 10)
    await query(
      `INSERT INTO users (name, email, contact, password, role, active, created_at, shop_id)
       VALUES ($1, $2, $3, $4, 'seller', true, NOW(), $5)`,
      [name, email, contact, hash, Number(shop_id)]
    )
    const { rows } = await query(`SELECT id, name, email, contact, shop_id, active FROM users WHERE email=$1`, [email])
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/sellers/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { name, contact, email, shop_id, passkey, active } = req.body
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    await transaction(async client => {
      if (passkey) {
        const hash = await bcrypt.hash(passkey, 10)
        await client.query(`UPDATE users SET password=$1 WHERE id=$2`, [hash, id])
      }
      await client.query(
        `UPDATE users
         SET name=COALESCE($1,name),
             contact=COALESCE($2,contact),
             email=COALESCE($3,email),
             shop_id=COALESCE($4,shop_id),
             active=COALESCE($5,active)
         WHERE id=$6 AND role='seller'`,
        [name || null, contact || null, email || null, shop_id || null, typeof active === 'boolean' ? active : null, id]
      )
    })
    const { rows } = await query(`SELECT id, name, email, contact, shop_id, active FROM users WHERE id=$1`, [id])
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.delete('/sellers/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    const { rows: salesRows } = await query(`SELECT COUNT(*) AS cnt FROM sales WHERE seller_id=$1`, [id])
    const hasSales = Number(salesRows[0].cnt) > 0
    if (hasSales) return res.status(409).json({ error: 'has_sales' })
    await query(`DELETE FROM users WHERE id=$1 AND role='seller'`, [id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/sellers/ranking', requireAuth, requireRole('admin'), async (req, res) => {
  const shopId = req.query.shopId ? Number(req.query.shopId) : null
  try {
    const params = []
    let whereShop = ''
    if (shopId) {
      params.push(shopId)
      whereShop = ` AND s.shop_id = $${params.length}`
    }
    const { rows } = await query(
      `SELECT u.id, u.name, u.shop_id, SUM(s.grand_total) AS total
       FROM sales s
       JOIN users u ON u.id = s.seller_id
       WHERE s.created_at::DATE = CURRENT_DATE${whereShop}
       GROUP BY u.id, u.name, u.shop_id
       ORDER BY total DESC
       LIMIT 50`,
      params
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

// New route for low stock alerts
router.get('/alerts/low-stock', requireAuth, requireRole('admin'), async (req, res) => {
  const shopId = req.query.shopId ? Number(req.query.shopId) : null
  try {
    const params = []
    let whereShop = ''
    if (shopId) {
      params.push(shopId)
      whereShop = ` AND st.shop_id = $${params.length}`
    }
    
    // Logic: on_hand < (on_hand + sold_count) * 0.25
    // To avoid division by zero if sold_count is 0, we can rewrite:
    // on_hand < (on_hand + sold_count) / 4  => 4 * on_hand < on_hand + sold_count => 3 * on_hand < sold_count
    // But what if sold_count is 0? Then 3 * on_hand < 0 -> on_hand < 0. That covers negative stock.
    // If on_hand is 100, sold is 0. 300 < 0? False.
    // If on_hand is 1, sold is 100. 3 < 100? True. (Stock 1, Initial 101. 1 < 25.25. Yes).
    // The requirement: "below 1/4 of its initial stock amount".
    // Initial Stock = on_hand + sold_count.
    // Alert if on_hand < (on_hand + sold_count) / 4.
    
    const { rows } = await query(
      `SELECT st.shop_id, sh.name AS shop_name, st.product_id, p.name AS product_name, st.on_hand, st.sold_count,
              (st.on_hand + st.sold_count) AS initial_stock
       FROM stock st
       JOIN products p ON p.id = st.product_id
       JOIN shops sh ON sh.id = st.shop_id
       WHERE st.on_hand < (st.on_hand + st.sold_count) * 0.25 ${whereShop}
       ORDER BY st.shop_id, p.name`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/notifications', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Alert when stock is below 1/4 of initial stock
    // Using multiplication to avoid float issues: current * 4 < initial
    const { rows } = await query(
      `SELECT id, name, total_stock, initial_stock
       FROM products
       WHERE active=true 
         AND initial_stock > 0
         AND (total_stock * 4) < initial_stock
       ORDER BY name ASC`
    )
    const notifications = rows.map(p => ({
      type: 'low_stock',
      product_id: p.id,
      message: `Low Stock: ${p.name} (Current: ${p.total_stock}, Initial: ${p.initial_stock})`,
      level: 'warning'
    }))
    res.json(notifications)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
