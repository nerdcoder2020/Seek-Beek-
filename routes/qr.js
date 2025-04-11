const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// Generate QR code
router.get('/:table_id', (req, res) => {
  const { table_id } = req.params;
  const url = `https://yourdomain.com/order/${table_id}`;
  QRCode.toDataURL(url, (err, qrCode) => {
    if (err) return res.status(500).json(err);
    res.status(200).json({ qrCode });
  });
});

module.exports = router;
