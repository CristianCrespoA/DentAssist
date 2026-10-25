require('dotenv').config();
const db = require('./src/models');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    await db.Usuario.destroy({ where: { email: 'admin@dentassist.com' } });
    await db.Usuario.create({
      nombre: 'Administrador',
      email: 'admin@dentassist.com',
      password: bcrypt.hashSync('admin123', 10),
      rol: 'admin'
    });
    console.log('created');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
