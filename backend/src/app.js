const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Detrás de proxy (Render/Railway/Fly) para obtener IPs correctas
app.set('trust proxy', 1);

// CORS configurable por variables de entorno
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite herramientas sin origen (curl/Postman) o si no hay lista configurada
      if (!origin || allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('No permitido por CORS'));
    },
    credentials: true
  })
);

// Meta firma el cuerpo crudo del webhook. Se guarda the buffer original antes
// de parsear para poder validar X-Hub-Signature-256 sin diferencias de formato.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, res, buffer) => {
      req.cuerpoCrudo = buffer;
    }
  })
);

app.use('/api', routes);

// Healthcheck para el proveedor de hosting
app.get('/api/health', (req, res) => {
  res.status(200).json({
    estado: 'ok',
    servicio: 'dentassist-backend',
    entorno: process.env.NODE_ENV || 'development',
    fecha: new Date().toISOString()
  });
});

app.get('/api/solicitudes/:id', (req, res) => {
  res.status(200).json({ id: req.params.id });
});

module.exports = app;