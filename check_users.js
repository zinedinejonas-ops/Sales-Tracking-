
import { query } from './src/db.js'

async function run() {
  try {
    const { rows } = await query(`SELECT id, name, role, active, shop_id FROM users`)
    console.log('Users:', JSON.stringify(rows, null, 2))
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}

run()
