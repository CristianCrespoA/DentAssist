require('dotenv').config();
const mysql = require('mysql2/promise');
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Conectado a MySQL');
    await connection.end();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al conectar a MySQL:', error.message);
  }
}

iniciarServidor();