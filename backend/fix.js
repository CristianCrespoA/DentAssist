const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('admin123', 10);
require('fs').writeFileSync('hash.txt', hash);
console.log(hash);
