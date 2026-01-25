import express from 'express'
import { query, transaction } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// Confirm a sale for a given shop.
// This endpoint:
// - Validates input items
// - Checks stock availability (and prevents overselling)
// - Computes totals from product prices and tax rates
// - Saves sale header and line items
// - Reduces stock quantities atomically in a single transaction
router.post('/shops/:shopId', requireAuth, async (req, res) => {
  const shopId = Number(req.params.shopId)
  const { items } = req.body

  // Basic validation of request payload
  if (!shopId || !Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ error: 'invalid_fields' })
  }
  if (req.user.role === 'seller' && Number(req.user.shopId || 0) !== shopId) {
    return res.status(403).json({ error: 'forbidden_shop' })
  }

  // Aggregate quantities by product_id to prevent duplicate item bypass
  const aggregatedItems = {}
  for (const item of items) {
    const pid = Number(item.product_id)
    const qty = Number(item.quantity)
    if (!pid || !qty || qty <= 0) {
      return res.status(422).json({ error: 'invalid_item' })
    }
    if (!aggregatedItems[pid]) aggregatedItems[pid] = 0
    aggregatedItems[pid] += qty
  }

  try {
    const result = await transaction(async (client) => {
      // First, lock and verify stock availability for each item.
      for (const [pidStr, totalQty] of Object.entries(aggregatedItems)) {
        const pid = Number(pidStr)
        
        // Lock the stock row to prevent race conditions during concurrent sales.
        const { rows: stockRows } = await client.query(
          'SELECT on_hand FROM stock WHERE shop_id=$1 AND product_id=$2 FOR UPDATE',
          [shopId, pid]
        )
        if (!stockRows.length) {
          throw Object.assign(new Error('stock_not_found'), { code: 'STOCK_NOT_FOUND', product_id: pid })
        }
        const onHand = Number(stockRows[0].on_hand)
        if (onHand < totalQty) {
          throw Object.assign(new Error('insufficient_stock'), { code: 'INSUFFICIENT_STOCK', product_id: pid, available: onHand, requested: totalQty })
        }
      }

      // Compute totals and prepare line details using current product pricing and tax.
      let subtotal = 0
      let taxTotal = 0
      let discountTotal = 0
      const lineDetails = []

      for (const item of items) {
        const pid = Number(item.product_id)
        const qty = Number(item.quantity)
        const { rows: pr } = await client.query(
          'SELECT id, sell_price, tax_rate FROM products WHERE id=$1 AND active=true',
          [pid]
        )
        if (!pr.length) {
          throw Object.assign(new Error('product_not_found'), { code: 'PRODUCT_NOT_FOUND', product_id: pid })
        }
        const price = Number(pr[0].sell_price)
        const taxRate = Number(pr[0].tax_rate)
        const lineSubtotal = price * qty
        const lineTax = (taxRate / 100) * lineSubtotal
        const lineTotal = lineSubtotal + lineTax

        subtotal += lineSubtotal
        taxTotal += lineTax
        lineDetails.push({ product_id: pid, quantity: qty, unit_price: price, tax_amount: lineTax, line_total: lineTotal })
      }

      const grandTotal = subtotal + taxTotal - discountTotal

      // Insert sale header with seller, shop, and computed totals.
      const { rows: idRows } = await client.query(
        `INSERT INTO sales (shop_id, seller_id, subtotal, tax_total, discount_total, grand_total, payment_status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, 'paid', NOW()) RETURNING id, created_at`,
        [shopId, req.user.userId, subtotal, taxTotal, discountTotal, grandTotal]
      )
      const saleId = idRows[0].id
      const saleDate = idRows[0].created_at

      // Insert each line item and decrement stock atomically (stock rows already locked).
      for (const line of lineDetails) {
        await client.query(
          `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, tax_amount, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [saleId, line.product_id, line.quantity, line.unit_price, 0, line.tax_amount, line.line_total]
        )
        await client.query(
          `UPDATE stock
           SET on_hand = on_hand - $1, sold_count = COALESCE(sold_count,0) + $2, updated_at = NOW()
           WHERE shop_id=$3 AND product_id=$4`,
          [line.quantity, line.quantity, shopId, line.product_id]
        )
      }

      // Return essential sale details for confirmation.
      return {
        saleId,
        saleDate,
        shopId,
        sellerId: req.user.userId,
        totals: { subtotal, taxTotal, discountTotal, grandTotal }
      }
    })

    res.status(201).json({
      id: result.saleId,
      date: result.saleDate,
      shop_id: result.shopId,
      seller_id: result.sellerId,
      totals: result.totals
    })
  } catch (err) {
    // Map known errors to friendly HTTP responses
    if (err && err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({ error: 'insufficient_stock', product_id: err.product_id, available: err.available, requested: err.requested })
    }
    if (err && err.code === 'STOCK_NOT_FOUND') {
      return res.status(404).json({ error: 'stock_not_found', product_id: err.product_id })
    }
    if (err && err.code === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'product_not_found', product_id: err.product_id })
    }
    if (err && err.code === 'INVALID_ITEM') {
      return res.status(422).json({ error: 'invalid_item' })
    }
    console.error(err)
    return res.status(500).json({ error: 'server_error' })
  }
})

// Bulk sales sync with profit calculation and duplicate detection
router.post('/sync', requireAuth, async (req, res) => {
  const { sales } = req.body
  if (!Array.isArray(sales) || sales.length === 0) {
    return res.status(400).json({ error: 'invalid_payload' })
  }
  const results = []
  for (const sale of sales) {
    try {
      const result = await transaction(async (client) => {
        const clientId = String(sale.client_id || sale.id || '')
        const shopId = Number(sale.shop_id)
        const items = Array.isArray(sale.items) ? sale.items : []
        const clientCreatedAt = new Date(sale.client_created_at || new Date().toISOString())
        if (!clientId || !shopId || !items.length || isNaN(clientCreatedAt.getTime())) {
          throw Object.assign(new Error('invalid_sale'), { code: 'INVALID_SALE' })
        }
        if (req.user.role === 'seller' && Number(req.user.shopId || 0) !== shopId) {
          throw Object.assign(new Error('forbidden_shop'), { code: 'FORBIDDEN_SHOP' })
        }
        const existing = await client.query('SELECT id FROM sales WHERE client_id=$1', [clientId])
        if (existing.rows.length) {
          return { status: 'duplicate', sale_id: existing.rows[0].id }
        }

        // Aggregate items to prevent double-spending stock within the same sale
        const aggregatedItems = {}
        for (const raw of items) {
          const pid = Number(raw.product_id)
          const qty = Number(raw.quantity)
          if (!pid || !qty || qty <= 0) {
            throw Object.assign(new Error('invalid_item'), { code: 'INVALID_ITEM' })
          }
          if (!aggregatedItems[pid]) aggregatedItems[pid] = 0
          aggregatedItems[pid] += qty
        }

        // Check stock for all items first
        for (const [pidStr, totalQty] of Object.entries(aggregatedItems)) {
          const pid = Number(pidStr)
          const { rows: stockRows } = await client.query('SELECT on_hand FROM stock WHERE shop_id=$1 AND product_id=$2 FOR UPDATE', [shopId, pid])
          if (!stockRows.length) {
            throw Object.assign(new Error('stock_not_found'), { code: 'STOCK_NOT_FOUND', product_id: pid })
          }
          const onHand = Number(stockRows[0].on_hand)
          if (onHand < totalQty) {
            throw Object.assign(new Error('insufficient_stock'), { code: 'INSUFFICIENT_STOCK', product_id: pid, available: onHand, requested: totalQty })
          }
        }

        let subtotal = 0
        let taxTotal = 0
        let discountTotal = 0
        const lineDetails = []
        for (const raw of items) {
          const pid = Number(raw.product_id)
          const qty = Number(raw.quantity)
          const discountPrice = raw.discount_price != null ? Number(raw.discount_price) : null
          
          const { rows: pr } = await client.query('SELECT sell_price, cost_price, tax_rate FROM products WHERE id=$1 AND active=true', [pid])
          if (!pr.length) {
            throw Object.assign(new Error('product_not_found'), { code: 'PRODUCT_NOT_FOUND', product_id: pid })
          }
          const defaultPrice = Number(pr[0].sell_price)
          const cost = Number(pr[0].cost_price)
          const price = discountPrice != null && !Number.isNaN(discountPrice) ? discountPrice : defaultPrice
          const taxRate = Number(pr[0].tax_rate)
          const lineSubtotal = price * qty
          const lineTax = (taxRate / 100) * lineSubtotal
          const lineTotal = lineSubtotal + lineTax
          const discountAmount = Math.max(0, (defaultPrice - price)) * qty
          const profitAmount = (price - cost) * qty
          subtotal += lineSubtotal
          taxTotal += lineTax
          discountTotal += discountAmount
          lineDetails.push({ product_id: pid, quantity: qty, unit_price: price, discount_amount: discountAmount, tax_amount: lineTax, line_total: lineTotal, profit_amount: profitAmount })
        }
        const grandTotal = subtotal + taxTotal - discountTotal
        const { rows: idRows } = await client.query(
          `INSERT INTO sales (shop_id, seller_id, subtotal, tax_total, discount_total, grand_total, payment_status, created_at, client_id, client_created_at)
           VALUES ($1,$2,$3,$4,$5,$6, 'paid', NOW(), $7, $8) RETURNING id`,
          [shopId, req.user.userId, subtotal, taxTotal, discountTotal, grandTotal, clientId, clientCreatedAt]
        )
        const saleId = idRows[0].id
        for (const line of lineDetails) {
          await client.query(
            `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount_amount, tax_amount, line_total, profit_amount)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [saleId, line.product_id, line.quantity, line.unit_price, line.discount_amount, line.tax_amount, line.line_total, line.profit_amount]
          )
          await client.query(
            `UPDATE stock SET on_hand = on_hand - $1, sold_count = COALESCE(sold_count,0) + $2, updated_at = NOW()
             WHERE shop_id=$3 AND product_id=$4`,
            [line.quantity, line.quantity, shopId, line.product_id]
          )
        }
        return { status: 'synced', sale_id: saleId }
      })
      results.push({ client_id: sale.client_id || sale.id, ...result })
    } catch (err) {
      const code = err && err.code ? err.code : 'ERROR'
      console.error(err)
      results.push({ client_id: sale.client_id || sale.id, status: 'error', code })
    }
  }
  res.json({ results })
})

export default router
