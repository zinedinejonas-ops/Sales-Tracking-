
import { query } from './src/db.js'
import bcrypt from 'bcryptjs'

async function run() {
  try {
    const hash = await bcrypt.hash('1234', 10)
    await query(`UPDATE users SET password=$1 WHERE name='Gabby Fernandez'`, [hash])
    console.log('Password updated for Gabby Fernandez to 1234')
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

run()
