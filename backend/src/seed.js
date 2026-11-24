// Creates the first admin: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('./config');
const User = require('./models/User');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars)');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri());
  if (await User.exists({ email })) console.log('Admin already exists');
  else {
    await User.create({ name: 'Administrator', email, role: 'admin', passwordHash: await bcrypt.hash(password, 12) });
    console.log('Admin created:', email);
  }
  await mongoose.disconnect();
})();
