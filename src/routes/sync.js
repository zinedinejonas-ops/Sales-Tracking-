import express from 'express'
import { transaction, query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

router.post('/offline-sales', requireAuth, async (req, res) => {
  const { sales } = req.body
  if (!Array.isArray(sales) || sales.length === 0) {
    return res.status(400).json({ error: 'invalid_payload' })
  }
  const user = req.user
  if (user.role !== 'seller' && user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden' })
  }
  const results = []
  for (const sale of sales) {
    try {
      const result = await transaction(async client => {
        const clientId = String(sale.client_id || '')
        const shopId = Number(sale.shop_id)
        const clientCreatedAt = new Date(sale.client_created_at)
        const items = Array.isArray(sale.items) ? sale.items : []
        if (!clientId || !shopId || !items.length || isNaN(clientCreatedAt.getTime())) {
          throw Object.assign(new Error('invalid_sale'), { code: 'INVALID_SALE' })
        }
        if (req.user.role === 'seller' && Number(req.user.shopId || 0) !== shopId) {
          throw Object.assign(new Error('forbidden_shop'), { code: 'FORBIDDEN_SHOP' })
        }
        const now = new Date()
        const diffMs = now.getTime() - clientCreatedAt.getTime()
        const hours = diffMs / 1000 / 60 / 60
        if (hours > 24) {
          throw Object.assign(new Error('too_old'), { code: 'TOO_OLD' })
        }
        const existing = await client.query('SELECT id FROM sales WHERE client_id=?', [clientId])
        if (existing.rows.length) {
          return { status: 'duplicate', sale_id: existing.rows[0].id }
        }
        let subtotal = 0
        let taxTotal = 0
        let discountTotal = 0
        const lineDetails = []
        for (const raw of items) {
          const pid = Number(raw.product_id)
          const qty = Number(raw.quantity)
          if (!pid || !qty || qty <= 0) {
            throw Object.assign(new Error('invalid_item'), { code: 'INVALID_ITEM' })
          }
          const stock = await client.query('SELECT on_hand FROM stock WHERE shop_id=? AND product_id=? FOR UPDATE', [shopId, pid])
          if (!stock.rows.length) {
            throw Object.assign(new Error('stock_not_found'), { code: 'STOCK_NOT_FOUND', product_id: pid })
          }
          const onHand = Number(stock.rows[0].on_hand)
          if (onHand < qty) {
            throw Object.assign(new Error('insufficient_stock'), { code: 'INSUFFICIENT_STOCK', product_id: pid, available: onHand, requested: qty })
          }
          const pr = await client.query('SELECT sell_price, tax_rate FROM products WHERE id=? AND active=1', [pid])
          if (!pr.rows.length) {
            throw Object.assign(new Error('product_not_found'), { code: 'PRODUCT_NOT_FOUND', product_id: pid })
          }
          const defaultPrice = Number(pr.rows[0].sell_price)
          const manual = raw.manual_price != null ? Number(raw.manual_price) : null
          const price = manual != null && !Number.isNaN(manual) ? manual : defaultPrice
          const taxRate = Number(pr.rows[0].tax_rate)
          const lineSubtotal = price * qty
          const lineTax = (taxRate / 100) * lineSubtotal
          const lineTotal = lineSubtotal + lineTax
          subtotal += lineSubtotal
          taxTotal += lineTax
          const discountAmount = Math.max(0, (defaultPrice - price)) * qty
          discountTotal += discountAmount
          lineDetails.push({ product_id: pid, quantity: qty, unit_price: price, discount_amount: discountAmount, tax_amount: lineTax, line_total: lineTotal })
        }
        const grandTotal = subtotal + taxTotal - discountTotal
        await client.query(
          `INSERT INTO sales (shop_id, seller_id, subtotal, tax_total, discount_total, grand_total, payment_status, created_at, client_id, client_created_at, synced_from_offline, synced_at)
           VALUES (?,?,?,?,?,?, 'paid', NOW(), ?, ?, 1, NOW())`,
          [shopId, user.userId, subtotal, taxTotal, discountTotal, grandTotal, clientId, clientCreatedAt]
        )
        const idRows = await client.query('SELECT LAST_INSERT_ID() AS id', [])
        const saleId = idRows.rows[0].id
        for (const line of lineDetails) {
          await client.query(
            `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, tax_amount, line_total)
             VALUES (?,?,?,?,?,?,?)`,
            [saleId, line.product_id, line.quantity, line.unit_price, line.discount_amount || 0, line.tax_amount, line.line_total]
          )
          await client.query(
            `UPDATE stock
             SET on_hand = on_hand - ?, sold_count = COALESCE(sold_count,0) + ?, updated_at = NOW()
             WHERE shop_id=? AND product_id=?`,
            [line.quantity, line.quantity, shopId, line.product_id]
          )
        }
        return { status: 'synced', sale_id: saleId }
      })
      results.push({ client_id: sale.client_id, ...result })
    } catch (err) {
      const code = err && err.code ? err.code : 'ERROR'
      results.push({ client_id: sale.client_id, status: 'error', code })
    }
  }
  res.json({ results })
})

router.get('/status', requireAuth, async (req, res) => {
  const clientId = String(req.query.client_id || '')
  if (!clientId) return res.status(400).json({ error: 'missing_client_id' })
  try {
    const { rows } = await query(
      `SELECT id AS sale_id, synced_from_offline, synced_at, created_at
       FROM sales
       WHERE client_id = ?`,
      [clientId]
    )
    if (!rows.length) return res.status(404).json({ error: 'not_found' })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'server_error' })
  }
})

export default router
