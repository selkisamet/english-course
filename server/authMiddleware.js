import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

export function verifyPassword(password) {
  return password === ADMIN_PASSWORD
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' })
  }

  const token = authHeader.substring(7)

  if (!verifyPassword(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' })
  }

  next()
}
