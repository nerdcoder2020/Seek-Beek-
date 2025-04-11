const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/middleware');

router.get('/api/restaurant/charge', authenticateAdmin, async (req, res) => {
  try {
    // 1. Fetch the price per order from settings
    const [settings] = await req.db.query('SELECT price FROM settings LIMIT 1');
    if (!settings || settings.length === 0 || !settings[0].price) {
      return res.status(400).json({ error: 'Price not configured in settings' });
    }
    const pricePerOrder = parseFloat(settings[0].price);

    // 2. Fetch count of unpaid completed orders
    const [orderResult] = await req.db.query(`
      SELECT COUNT(*) as unpaid_count 
      FROM orders 
      WHERE status = 'Completed' AND is_paid = 0
    `);
    const unpaidOrderCount = parseInt(orderResult[0].unpaid_count, 10);

    // 3. Calculate total charge
    const totalCharge = unpaidOrderCount * pricePerOrder;

    // 4. Return the result
    res.json({
      unpaidOrderCount,
      pricePerOrder,
      totalCharge,
      currency: 'INR', // Adjust as needed
    });
  } catch (err) {
    console.error('Error calculating restaurant charge:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/api/restaurant/charge/mark-paid', authenticateAdmin, async (req, res) => {
  try {
    // 1. Mark all unpaid completed orders as paid
    const [result] = await req.db.query(`
      UPDATE orders 
      SET is_paid = 1 
      WHERE status = 'Completed' AND is_paid = 0
    `);

    const affectedRows = result.affectedRows;

    if (affectedRows === 0) {
      return res.status(400).json({ message: 'No unpaid completed orders to mark as paid' });
    }

    // 2. Return success response
    res.json({
      message: 'Payment marked successfully',
      ordersMarkedPaid: affectedRows,
    });
  } catch (err) {
    console.error('Error marking orders as paid:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;