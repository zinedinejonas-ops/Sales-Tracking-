import express from 'express'
import dotenv from 'dotenv'
import authRouter from './routes/auth.js'
import productsRouter from './routes/products.js'
import stockRouter from './routes/stock.js'
import salesRouter from './routes/sales.js'
import reportsRouter from './routes/reports.js'
import syncRouter from './routes/sync.js'
import adminRouter from './routes/admin.js'
import sellersRouter from './routes/sellers.js'
import shopsRouter from './routes/shops.js'
import profitRouter from './routes/profit.js'
import { query } from './db.js'

dotenv.config()

const app = express()
app.use(express.json())
app.get('/', (req, res) => {
  res.redirect('/admin-mobile.html#login')
})

app.use(express.static('public'))

app.get('/admin-mobile.html', (req, res) => {
  res.sendFile('index.html', { root: 'public' })
})

app.use('/auth', authRouter)
app.use('/products', productsRouter)
app.use('/stock', stockRouter)
app.use('/sales', salesRouter)
app.use('/reports', reportsRouter)
app.use('/sync', syncRouter)
app.use('/admin', adminRouter)
app.use('/sellers', sellersRouter)
app.use('/shops', shopsRouter)
app.use('/profit', profitRouter)

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

const port = process.env.PORT || 10000
app.listen(port, async () => {
  console.log(`Server listening on port ${port}`)
  try {
    await query('SELECT 1')
    console.log('Database connection successful')
  } catch (err) {
    console.error('Database connection failed:', err)
  }
})
