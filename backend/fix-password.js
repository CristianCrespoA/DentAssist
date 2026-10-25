const bcrypt = require('bcryptjs');
const db = require('./src/models');

bcrypt.hash('admin123', 10).then(hash => {
  db.Usuario.update({ password: hash }, { where: { email: 'admin@dentassist.com' } })
    .then(() => {
      console.log('updated');
      process.exit(0);
    })
    .catch(e => {
      console.log(e.message);
      process.exit(1);
    });
});
