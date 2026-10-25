require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('./src/config/database')[process.env.NODE_ENV || 'development'];
const sequelize = new Sequelize(config.database, config.username, config.password, config);
const bcrypt = require('bcryptjs');

async function run() {
  try {
    await sequelize.query("UPDATE Usuarios SET password = ? WHERE email = ?", {
      replacements: [bcrypt.hashSync('admin123', 10), 'admin@dentassist.com']
    });
    console.log('done');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
run();
