import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized' })
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })
    if (req.user.role !== role) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}
