import express from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.get('/stock-per-shop', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT sh.id AS shop_id,
              sh.name AS shop_name,
              COALESCE(SUM(st.on_hand),0) AS stock_on_hand,
              COALESCE(SUM(st.sold_count),0) AS sold_count,
              COUNT(DISTINCT CASE WHEN st.product_id IS NOT NULL THEN st.product_id END) AS product_count
       FROM shops sh
       LEFT JOIN stock st ON st.shop_id = sh.id
       GROUP BY sh.id, sh.name
       ORDER BY stock_on_hand DESC`,
      []
    )
    res.json(rows)
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/sales', requireAuth, async (req, res) => {
  const period = String(req.query.period || 'daily')
  const shopId = req.query.shopId ? Number(req.query.shopId) : null
  try {
    const params = []
    let where = '1=1'
    if (shopId) {
      params.push(shopId)
      where = `shop_id = $${params.length}`
    }
    let sql
    if (period === 'weekly') {
      sql = `
        SELECT DATE_TRUNC('week', created_at) AS period,
               COUNT(*) AS sales_count,
               SUM(subtotal) AS subtotal,
               SUM(tax_total) AS tax_total,
               SUM(discount_total) AS discount_total,
               SUM(grand_total) AS grand_total
        FROM sales
        WHERE ${where}
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY DATE_TRUNC('week', created_at) DESC
        LIMIT 90
      `
    } else if (period === 'monthly') {
      sql = `
        SELECT DATE_TRUNC('month', created_at) AS period,
               COUNT(*) AS sales_count,
               SUM(subtotal) AS subtotal,
               SUM(tax_total) AS tax_total,
               SUM(discount_total) AS discount_total,
               SUM(grand_total) AS grand_total
        FROM sales
        WHERE ${where}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at) DESC
        LIMIT 90
      `
    } else {
      sql = `
        SELECT created_at::DATE AS period,
               COUNT(*) AS sales_count,
               SUM(subtotal) AS subtotal,
               SUM(tax_total) AS tax_total,
               SUM(discount_total) AS discount_total,
               SUM(grand_total) AS grand_total
        FROM sales
        WHERE ${where}
        GROUP BY created_at::DATE
        ORDER BY created_at::DATE DESC
        LIMIT 90
      `
    }
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/top-products', requireAuth, async (req, res) => {
  const period = String(req.query.period || 'weekly')
  const shopId = req.query.shopId ? Number(req.query.shopId) : null
  const limit = req.query.limit ? Number(req.query.limit) : 10
  try {
    let whereDate = "DATE_TRUNC('week', s.created_at) = DATE_TRUNC('week', CURRENT_DATE)"
    if (period === 'monthly') {
      whereDate = "DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', CURRENT_DATE)"
    }
    const params = []
    let whereShop = ''
    if (shopId) {
      params.push(shopId)
      whereShop = ` AND s.shop_id = $${params.length}`
    }
    const sql = `
      SELECT si.product_id,
             p.name,
             SUM(si.quantity) AS total_quantity
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE ${whereDate}${whereShop}
      GROUP BY si.product_id, p.name
      ORDER BY total_quantity DESC
      LIMIT ${limit}
    `
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/sales-per-shop', requireAuth, async (req, res) => {
  const period = String(req.query.period || 'monthly')
  try {
    let whereDate = "DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', CURRENT_DATE)"
    if (period === 'weekly') {
      whereDate = "DATE_TRUNC('week', s.created_at) = DATE_TRUNC('week', CURRENT_DATE)"
    }
    if (period === 'daily') {
      whereDate = "s.created_at::DATE = CURRENT_DATE"
    }
    const sql = `
      SELECT sh.id AS shop_id,
             sh.name AS shop_name,
             COUNT(s.id) AS sales_count,
             SUM(s.grand_total) AS grand_total
      FROM sales s
      JOIN shops sh ON sh.id = s.shop_id
      WHERE ${whereDate}
      GROUP BY sh.id, sh.name
      ORDER BY grand_total DESC
    `
    const { rows } = await query(sql, [])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
