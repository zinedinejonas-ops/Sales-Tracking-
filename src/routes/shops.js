import express from 'express'
import { query, transaction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = express.Router()

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const search = String(req.query.search || '').trim()
  try {
    let sql = `
      SELECT s.id, s.name, s.location, s.active, s.created_at,
             u.id AS seller_id, u.name AS seller_name
      FROM shops s
      LEFT JOIN users u ON u.shop_id = s.id AND u.role = 'seller'
    `
    const params = []
    if (search) {
      sql += ` WHERE s.name LIKE ?`
      params.push(`%${search}%`)
    }
    sql += ` ORDER BY s.name ASC LIMIT 200`
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/ranking', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sql = `
      SELECT sh.id AS shop_id,
             sh.name AS shop_name,
             SUM(s.grand_total) AS total_sales
      FROM sales s
      JOIN shops sh ON sh.id = s.shop_id
      GROUP BY sh.id, sh.name
      ORDER BY total_sales DESC
      LIMIT 50
    `
    const { rows } = await query(sql, [])
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, seller_id } = req.body
  if (!name) return res.status(400).json({ error: 'missing_fields' })
  try {
    const result = await transaction(async client => {
      await client.query(`INSERT INTO shops (name, active, created_at) VALUES (?, 1, NOW())`, [name])
      const { rows: idRows } = await client.query(`SELECT LAST_INSERT_ID() AS id`, [])
      const shopId = idRows[0].id
      if (seller_id) {
        await client.query(`UPDATE users SET shop_id=? WHERE id=? AND role='seller'`, [shopId, Number(seller_id)])
      }
      const { rows } = await client.query(`SELECT id, name, active FROM shops WHERE id=?`, [shopId])
      return rows[0]
    })
    res.status(201).json(result)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id)
  const { name, seller_id, active } = req.body
  if (!id) return res.status(400).json({ error: 'invalid_id' })
  try {
    await transaction(async client => {
      await client.query(
        `UPDATE shops SET name=COALESCE(?, name), active=COALESCE(?, active) WHERE id=?`,
        [name || null, typeof active === 'boolean' ? (active ? 1 : 0) : null, id]
      )
      if (seller_id) {
        await client.query(`UPDATE users SET shop_id=? WHERE id=? AND role='seller'`, [id, Number(seller_id)])
      }
    })
    const { rows } = await query(`SELECT id, name, active FROM shops WHERE id=?`, [id])
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
    const { rows: salesRows } = await query(`SELECT COUNT(*) AS cnt FROM sales WHERE shop_id=?`, [id])
    const hasSales = Number(salesRows[0].cnt) > 0
    if (hasSales) return res.status(409).json({ error: 'has_sales' })
    await query(`DELETE FROM shops WHERE id=?`, [id])
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
