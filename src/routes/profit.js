import express from 'express'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

function tzs(n) {
  const v = Math.round(Number(n || 0))
  return new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(v) + ' TZS'
}

router.get('/daily', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT sh.id AS shop_id, sh.name AS shop_name,
              SUM((si.unit_price - p.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN shops sh ON sh.id = s.shop_id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at::DATE = CURRENT_DATE
       GROUP BY sh.id, sh.name
       ORDER BY profit DESC`,
      []
    )
    const data = rows.map(r => ({ shop_id: r.shop_id, shop_name: r.shop_name, profit: Number(r.profit || 0), profit_formatted: tzs(r.profit || 0) }))
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/monthly', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT sh.id AS shop_id, sh.name AS shop_name,
              SUM((si.unit_price - p.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN shops sh ON sh.id = s.shop_id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY sh.id, sh.name
       ORDER BY profit DESC`,
      []
    )
    const data = rows.map(r => ({ shop_id: r.shop_id, shop_name: r.shop_name, profit: Number(r.profit || 0), profit_formatted: tzs(r.profit || 0) }))
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/weekly', requireAuth, async (req, res) => {
  try {
    const { rows: totals } = await query(
      `SELECT sh.id AS shop_id, sh.name AS shop_name,
              SUM((si.unit_price - p.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN shops sh ON sh.id = s.shop_id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY sh.id, sh.name
       ORDER BY profit DESC`,
      []
    )
    const { rows: byProduct } = await query(
      `SELECT sh.id AS shop_id, sh.name AS shop_name,
              si.product_id, pr.name AS product_name,
              SUM((si.unit_price - pr.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN shops sh ON sh.id = s.shop_id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products pr ON pr.id = si.product_id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY sh.id, sh.name, si.product_id, pr.name`,
      []
    )
    const topMap = {}
    for (const r of byProduct) {
      const k = String(r.shop_id)
      const val = Number(r.profit || 0)
      if (!topMap[k] || val > topMap[k].profit) {
        topMap[k] = { product_id: r.product_id, product_name: r.product_name, profit: val, profit_formatted: tzs(val) }
      }
    }
    const data = totals.map(t => ({
      shop_id: t.shop_id, shop_name: t.shop_name,
      profit: Number(t.profit || 0), profit_formatted: tzs(t.profit || 0),
      top_product: topMap[String(t.shop_id)] || null
    }))
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/overview', requireAuth, async (req, res) => {
  try {
    const daily = await query(
      `SELECT sh.id AS shop_id, sh.name AS shop_name,
              SUM((si.unit_price - p.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN shops sh ON sh.id = s.shop_id
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at::DATE = CURRENT_DATE
       GROUP BY sh.id, sh.name`,
      []
    )
    const weekly = await query(
      `SELECT SUM((si.unit_price - p.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '7 days'`,
      []
    )
    const monthly = await query(
      `SELECT SUM((si.unit_price - p.cost_price) * si.quantity) AS profit
       FROM sales s
       JOIN sale_items si ON si.sale_id = s.id
       JOIN products p ON p.id = si.product_id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'`,
      []
    )
    res.json({
      daily_per_shop: (daily.rows || []).map(r => ({
        shop_id: r.shop_id, shop_name: r.shop_name,
        profit: Number(r.profit || 0), profit_formatted: tzs(r.profit || 0)
      })),
      weekly_total: Number((weekly.rows[0] && weekly.rows[0].profit) || 0),
      weekly_total_formatted: tzs((weekly.rows[0] && weekly.rows[0].profit) || 0),
      monthly_total: Number((monthly.rows[0] && monthly.rows[0].profit) || 0),
      monthly_total_formatted: tzs((monthly.rows[0] && monthly.rows[0].profit) || 0)
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
