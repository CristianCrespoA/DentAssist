const bcrypt = require('bcryptjs');
const db = require('./src/models');

db.Usuario.findOne({ where: { email: 'admin@dentassist.com' } })
  .then(user => {
    if (!user) {
      console.log('no user');
      process.exit(1);
    }
    console.log(bcrypt.compareSync('admin123', user.password));
    process.exit(0);
  })
  .catch(e => {
    console.log(e.message);
    process.exit(1);
  });
