import express from 'express'
import bcrypt from 'bcryptjs'
import { query } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const search = String(req.query.search || '').trim()
  try {
    let sql = `SELECT id, name, email, shop_id, active FROM users WHERE role='seller'`
    const params = []
    if (search) {
      sql += ` AND name LIKE ?`
      params.push(`%${search}%`)
    }
    sql += ` ORDER BY name ASC LIMIT 200`
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, contact, shop_id, password } = req.body
  if (!name || !contact || !password) return res.status(400).json({ error: 'missing_fields' })
  try {
    const cleanName = name.trim()
    const hash = await bcrypt.hash(password, 10)
    await query(
      `INSERT INTO users (name, email, password, role, active, shop_id)
       VALUES (?,?,?,?,1,?)`,
      [cleanName, contact, hash, 'seller', shop_id ? Number(shop_id) : null]
    )
    const { rows } = await query(`SELECT id, name, email, shop_id FROM users WHERE role='seller' AND email=?`, [contact])
    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { name, contact, shop_id, password, active } = req.body
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await query(`UPDATE users SET password=? WHERE id=? AND role='seller'`, [hash, id])
    }
    await query(
      `UPDATE users
       SET name=COALESCE(?, name),
           email=COALESCE(?, email),
           shop_id=COALESCE(?, shop_id),
           active=COALESCE(?, active)
       WHERE id=? AND role='seller'`,
      [name ? name.trim() : null, contact || null, typeof shop_id !== 'undefined' ? Number(shop_id) : null, typeof active === 'boolean' ? (active ? 1 : 0) : null, id]
    )
    const { rows } = await query(`SELECT id, name, email, shop_id, active FROM users WHERE id=? AND role='seller'`, [id])
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    const { rows: hasSales } = await query(`SELECT 1 FROM sales WHERE seller_id=? LIMIT 1`, [id])
    if (hasSales.length) {
      return res.status(409).json({ error: 'cannot_delete', reason: 'seller_has_sales' })
    }
    await query(`DELETE FROM users WHERE id=? AND role='seller'`, [id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/ranking', requireAuth, requireRole('admin'), async (req, res) => {
  const period = String(req.query.period || 'daily')
  try {
    let whereDate = 'DATE(s.created_at) = DATE(NOW())'
    if (period === 'weekly') whereDate = 'YEARWEEK(s.created_at, 1) = YEARWEEK(NOW(), 1)'
    if (period === 'monthly') whereDate = 'YEAR(s.created_at) = YEAR(NOW()) AND MONTH(s.created_at) = MONTH(NOW())'
    const sql = `
      SELECT u.id AS seller_id,
             u.name AS seller_name,
             SUM(s.grand_total) AS total_sales
      FROM sales s
      JOIN users u ON u.id = s.seller_id
      WHERE ${whereDate}
      GROUP BY u.id, u.name
      ORDER BY total_sales DESC
      LIMIT 50
    `
    const { rows } = await query(sql, [])
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
