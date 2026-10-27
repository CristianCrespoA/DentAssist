const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

app.use(cors());

// Meta firma el cuerpo crudo del webhook. Se guarda el buffer original antes
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

app.get('/api/health', (req, res) => {
  res.json({ mensaje: 'El servidor está funcionando 🚀' });
});

module.exports = app;