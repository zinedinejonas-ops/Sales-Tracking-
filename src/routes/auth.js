import express from 'express'
import { query } from '../db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = express.Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' })
  try {
    const { rows } = await query('SELECT id, name, email, password, role, active FROM users WHERE email=?', [email])
    if (!rows.length) return res.status(401).json({ error: 'invalid_credentials' })
    const user = rows[0]
    if (!user.active) return res.status(403).json({ error: 'inactive_user' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '8h' })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'server_error: ' + err.message })
  }
})

// Seller login with name + 4-digit passkey
router.post('/seller-login', async (req, res) => {
  const { name, passkey } = req.body
  console.log(`Seller login attempt: name="${name}"`)
  if (!name || !passkey) return res.status(400).json({ error: 'missing_fields' })
  try {
    // Trim input name and compare with trimmed DB name to handle accidental spaces
    const cleanName = name.trim()
    const { rows } = await query(
      'SELECT id, name, password, role, active, shop_id FROM users WHERE role=\'seller\' AND TRIM(name)=?',
      [cleanName]
    )
    if (!rows.length) {
      console.log(`Seller login failed: User "${cleanName}" not found or not a seller.`)
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    const user = rows[0]
    if (!user.active) return res.status(403).json({ error: 'inactive_user' })
    const ok = await bcrypt.compare(passkey, user.password)
    if (!ok) {
      console.log(`Seller login failed: Password mismatch for "${name}".`)
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    console.log(`Seller login success: "${name}"`)
    const token = jwt.sign(
      { userId: user.id, role: 'seller', shopId: user.shop_id || null },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '12h' }
    )
    res.json({ token, user: { id: user.id, name: user.name, role: 'seller', shop_id: user.shop_id || null } })
  } catch (err) {
    console.error('Seller login error:', err)
    res.status(500).json({ error: 'server_error: ' + err.message })
  }
})

export default router
