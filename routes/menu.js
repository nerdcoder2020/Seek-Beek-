const express = require('express');
const router = express.Router();
const connection = require('../db/config');
const { authenticateAdmin } = require('../middleware/middleware');

// API to fetch all menu items
router.get('/api/menu', authenticateAdmin, async (req, res) => {
  try {
    const [results] = await req.db.query('SELECT * FROM menu');
    const menu = results.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      price: item.price,
      category: item.category,
    }));
    res.json(menu);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// API to fetch top-selling items
router.get('/api/top-sellers', authenticateAdmin, async (req, res) => {
  try {
    const query = `
      WITH TopItems AS (
        SELECT 
          item.name AS item_name,
          SUM(item.quantity) AS total_quantity
        FROM orders
        CROSS JOIN JSON_TABLE(
          items,
          '$[*]' COLUMNS (
            name VARCHAR(255) PATH '$.name',
            quantity INT PATH '$.quantity'
          )
        ) AS item
        WHERE status = 'Completed'
        AND created_on >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY item.name
        ORDER BY total_quantity DESC
        LIMIT 7
      )
      SELECT 
        m.id,
        m.name,
        m.price,
        m.image,
        m.category,
        ti.total_quantity AS quantity_sold
      FROM TopItems ti
      JOIN menu m ON m.name COLLATE utf8mb4_unicode_ci = ti.item_name COLLATE utf8mb4_unicode_ci
      ORDER BY ti.total_quantity DESC;
    `;
    const [results] = await req.db.query(query);

    const topSellers = results.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      price: parseFloat(row.price),
      image: row.image,
      category: row.category,
      quantitySold: parseInt(row.quantity_sold, 10),
    }));

    res.json(topSellers);
  } catch (err) {
    console.error('Error fetching top sellers:', err);
    res.status(500).send('Database error');
  }
});

// API to add a new menu item
router.post('/api/add-item', authenticateAdmin, async (req, res) => {
  try {
    const { name, image, price, category } = req.body;
    const query = 'INSERT INTO menu (name, image, price, category) VALUES (?, ?, ?, ?)';
    await req.db.query(query, [name, image, price || 0, category]);
    res.json({ message: 'Menu item added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// API to update an item's price
router.put('/api/update-item/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const query = 'UPDATE menu SET price = ? WHERE id = ?';
    await req.db.query(query, [price, id]);
    res.json({ message: 'Menu item updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// API to delete a menu item
router.delete('/api/delete-item/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM menu WHERE id = ?';
    await req.db.query(query, [id]);
    res.json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// API to get all distinct categories
router.get('/api/categories', authenticateAdmin, async (req, res) => {
  try {
    const query = 'SELECT DISTINCT category FROM menu';
    const [results] = await req.db.query(query);
    const categories = results.map((row) => row.category);
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).send('Database error');
  }
});

module.exports = router;