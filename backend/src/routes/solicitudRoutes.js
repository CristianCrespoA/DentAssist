const express = require('express');
const router = express.Router();

router.get('/:id', function(req, res) {
  return res.json({ id: req.params.id });
});

module.exports = router;
