
async function run() {
  try {
    const res = await fetch('http://localhost:3000/auth/seller-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gabby Fernandez', passkey: '1234' })
    })
    const data = await res.json()
    console.log('Status:', res.status)
    console.log('Data:', data)
  } catch (e) {
    console.error(e)
  }
}

run()
