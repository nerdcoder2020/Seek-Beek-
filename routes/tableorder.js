const express = require("express");
const router = express.Router();
const { authenticateAdmin } = require('../middleware/middleware');

// Add a new table order
router.post('/api/tableorder', authenticateAdmin, async (req, res) => {
  try {
    const { table_number, section_id, items, total_amount, payment_method } = req.body;

    // Validate required fields for table order
    if (!table_number || !section_id || !items || !total_amount || !payment_method) {
      return res.status(400).json({ message: 'Table number, section ID, items, total amount, and payment method are required' });
    }

    // Verify the table exists with the given table_number and section_id
    const [tableCheck] = await req.db.query(
      'SELECT id FROM tables WHERE table_number = ? AND section_id = ?',
      [table_number, section_id]
    );
    if (tableCheck.length === 0) {
      return res.status(400).json({ message: 'Invalid table number or section ID' });
    }

    const query = `
      INSERT INTO orders (table_number, section_id, items, total_amount, payment_method, status)
      VALUES (?, ?, ?, ?, ?, 'Pending')
    `;
    const [result] = await req.db.query(query, [
      table_number,
      section_id,
      JSON.stringify(items),
      total_amount,
      payment_method
    ]);

    const newOrder = {
      id: result.insertId,
      table_number,
      section_id,
      items,
      total_amount,
      payment_method,
      status: 'Pending'
    };
    req.wss.broadcast({ type: "new_table_order", order: newOrder });
    res.status(201).json({ message: 'Table order added successfully', orderId: result.insertId });
  } catch (err) {
    console.error('Error adding table order:', err);
    res.status(500).send('Database error');
  }
});

// Fetch all orders (including table orders)
router.get('/api/tableorder', authenticateAdmin, async (req, res) => {
  try {
    const query = `SELECT * FROM orders WHERE status = 'Pending' ORDER BY created_on DESC`;
    const [results] = await req.db.query(query);

    const processedResults = results.map(order => ({
      id: order.id,
      table_number: order.table_number,
      section_id: order.section_id,
      items: JSON.stringify(order.items || '[]'), // Parse items if stored as JSON
      total_amount: order.total_amount,
      payment_method: order.payment_method,
      status: order.status
    }));

    res.json(processedResults);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).send('Database error');
  }
});

// Update an order status
router.put("/api/tableorder/:id", authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const query = "UPDATE orders SET status = ? WHERE id = ?";
    const [result] = await req.db.query(query, [status, orderId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fetch the updated order to include in the broadcast
    const [rows] = await req.db.query("SELECT * FROM orders WHERE id = ?", [orderId]);
    const updatedOrder = rows[0];

    // Broadcast the updated order status to all clients
    req.wss.broadcast({
      type: "update_table_order",
      order: {
        id: Number(updatedOrder.id),
        table_number: updatedOrder.table_number,
        section_id: updatedOrder.section_id,
        total_amount: updatedOrder.total_amount,
        payment_method: updatedOrder.payment_method,
        items: JSON.stringify(updatedOrder.items || '[]'),
        status: updatedOrder.status,
      },
    });

    res.json({ message: "Order status updated successfully" });
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).send("Database error");
  }
});

// Update order items and total_amount
router.put('/api/tableorder/update/:id', authenticateAdmin, async (req, res) => {
  const { items, total_amount, status } = req.body;
  const orderId = req.params.id;

  // Validate required fields
  if (!items || total_amount === undefined || !status) {
    return res.status(400).json({ error: 'Items, total_amount, and status are required' });
  }

  try {
    // Update the order in the database
    await req.db.query(
      'UPDATE orders SET items = ?, total_amount = ?, status = ? WHERE id = ?',
      [JSON.stringify(items), total_amount, status, orderId]
    );

    // Fetch the updated order (including table_number and section_id)
    const [rows] = await req.db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const updatedOrder = rows[0];

    // Prepare the order for broadcast (items is already a JSON string from DB)
    const orderToBroadcast = {
      id: Number(updatedOrder.id),
      table_number: updatedOrder.table_number,
      section_id: updatedOrder.section_id,
      total_amount: updatedOrder.total_amount,
      payment_method: updatedOrder.payment_method,
      items: JSON.stringify(updatedOrder.items || '[]'),
      status: updatedOrder.status,
    };

    // Broadcast the full order via WebSocket
    req.wss.broadcast({
      type: 'update_table_order',
      order: orderToBroadcast,
    });

    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});
// Delete an order
router.delete("/api/tableorder/:id", authenticateAdmin, async (req, res) => {
  try {
    const orderId = req.params.id;
    
    // Fetch order details for broadcast
    const [orderCheck] = await req.db.query(
      "SELECT table_number, section_id FROM orders WHERE id = ?",
      [orderId]
    );
    if (orderCheck.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const { table_number, section_id } = orderCheck[0];

    // Delete order from database
    const [result] = await req.db.query(
      "DELETE FROM orders WHERE id = ?",
      [orderId]
    );

    // Broadcast deletion to WebSocket clients
    req.wss.broadcast({ 
      type: "delete_table_order", 
      id: orderId,
      order: { table_number, section_id }
    });

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting order:", err);
    res.status(500).send("Database error");
  }
});

module.exports = router;