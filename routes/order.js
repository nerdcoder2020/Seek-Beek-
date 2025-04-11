const express = require("express");
const router = express.Router();
const connection = require("../db/config");
const { authenticateAdmin } = require('../middleware/middleware');

// Add a new order
router.post('/api/orders', authenticateAdmin, async (req, res) => {
  try {
    const { customer_name, phone, items, total_amount, payment_method } = req.body;

    const phoneToInsert = phone || null;

    const query = `
      INSERT INTO orders (customer_name, phone, items, total_amount, payment_method, status)
      VALUES (?, ?, ?, ?, ?, 'Pending')
    `;
    const [result] = await req.db.query(query, [
      customer_name,
      phoneToInsert,
      JSON.stringify(items),
      total_amount,
      payment_method
    ]);

    const newOrder = {
      id: result.insertId,
      customer_name,
      phone: phoneToInsert,
      items,
      total_amount,
      payment_method,
      status: 'Pending'
    };
    req.wss.broadcast({ type: "new_order", order: newOrder });
    res.status(201).json({ message: 'Order added successfully', orderId: result.insertId });
  } catch (err) {
    console.error('Error adding order:', err);
    res.status(500).send('Database error');
  }
});

// Fetch all orders (no WebSocket needed)
router.get('/api/orders', authenticateAdmin, async (req, res) => {
  try {
    const query = `SELECT * FROM orders WHERE customer_name IS NOT NULL AND status = 'Pending' ORDER BY created_on DESC`;
    const [results] = await req.db.query(query);

    const processedResults = results.map(order => {
      return order;
    });

    res.json(processedResults);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Database error');
  }
});

// Update an order status
router.put('/api/orders/:id', authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    const query = 'UPDATE orders SET status = ? WHERE id = ?';
    const [result] = await req.db.query(query, [status, orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const [rows] = await req.db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const updatedOrder = rows[0];

    
    const updatedOrder2 = { id: updatedOrder.id, status: updatedOrder.status };
    req.wss.broadcast({ type: "complete_order", order: updatedOrder2 });

    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).send('Database error');
  }
});

// Update order items and total_amount
router.put("/api/updateorders/:id", authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { items, total_amount } = req.body;

    const updateQuery = `
      UPDATE orders 
      SET total_amount = ?, items = ? 
      WHERE id = ?
    `;

    const [result] = await req.db.query(updateQuery, [
      total_amount,
      JSON.stringify(items),
      orderId
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updatedOrder = { id: orderId, items, total_amount };
    req.wss.broadcast({ type: "update_order", order: updatedOrder });

    res.json({ message: "Order updated successfully" });
  } catch (err) {
    console.error("Error updating order:", err);
    res.status(500).send("Database error");
  }
});

// Delete an order
router.delete("/api/orders/:id", authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // First verify order exists
    const [checkResult] = await req.db.query(
      "SELECT id FROM orders WHERE id = ?",
      [orderId]
    );

    if (checkResult.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Delete order from database
    const [result] = await req.db.query(
      "DELETE FROM orders WHERE id = ?",
      [orderId]
    );

    // Broadcast deletion to WebSocket clients
    req.wss.broadcast({ 
      type: "delete_order", 
      id: orderId 
    });

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).send("Database error");
  }
});

module.exports = router;