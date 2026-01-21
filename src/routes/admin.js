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

export default router
