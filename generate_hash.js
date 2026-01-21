import bcrypt from 'bcryptjs';

const password = process.argv[2];

if (!password) {
  console.log('Usage: node generate_hash.js <your_password>');
  process.exit(1);
}

const salt = await bcrypt.genSalt(10);
const hash = await bcrypt.hash(password, salt);

console.log('\n--- Password Hash Generator ---');
console.log(`Password: ${password}`);
console.log(`Hash:     ${hash}`);
console.log('-------------------------------');
console.log('Copy the Hash value above and use it in your SQL INSERT statement.');
