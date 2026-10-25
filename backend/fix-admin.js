require('dotenv').config();
const db = require('./src/models');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const [updated] = await db.Usuario.update(
      { password: bcrypt.hashSync('admin123', 10) },
      { where: { email: 'admin@dentassist.com' } }
    );
    console.log('Actualizados:', updated);
    const user = await db.Usuario.findOne({ where: { email: 'admin@dentassist.com' } });
    console.log('Email:', user.email, 'Rol:', user.rol);
    console.log('Password válido:', bcrypt.compareSync('admin123', user.password));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
