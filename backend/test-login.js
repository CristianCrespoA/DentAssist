require('dotenv').config();
const authService = require('./src/services/authService');

authService.login('admin@dentassist.com', 'admin123')
  .then(r => {
    console.log('OK');
    console.log(r.token.substring(0,20));
    process.exit(0);
  })
  .catch(e => {
    console.log('ERR:', e.message);
    process.exit(1);
  });
