const express = require("express");
const router = express.Router();
const connection = require("../db/config");
const { authenticateAdmin } = require('../middleware/middleware');


// Fetch aggregated sales data
router.get("/api/sales", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        item_details.name AS name,
        SUM(item_details.quantity) AS quantity,
        SUM(item_details.price * item_details.quantity) AS revenue
      FROM (
        SELECT 
          JSON_UNQUOTE(JSON_EXTRACT(item, '$.name')) AS name,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.quantity')) AS UNSIGNED) AS quantity,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.price')) AS DECIMAL(10, 2)) AS price
        FROM orders
        JOIN JSON_TABLE(items, '$[*]' COLUMNS (
          item JSON PATH '$',
          name VARCHAR(255) PATH '$.name',
          quantity INT PATH '$.quantity',
          price DECIMAL(10, 2) PATH '$.price'
        )) AS item_details
        WHERE status = 'Completed' AND is_deleted = 0
      ) AS item_details
      GROUP BY item_details.name
      ORDER BY revenue DESC;
    `;

    const [results] = await req.db.query(query);

    const salesData = results.map((row) => ({
      name: row.name,
      quantity: parseInt(row.quantity, 10),
      revenue: parseFloat(row.revenue),
    }));

    res.json(salesData);
  } catch (err) {
    console.error("Error fetching sales data:", err);
    res.status(500).send("Failed to load sales data.");
  }
});

// Fetch completed sales details
router.get("/api/sale", authenticateAdmin, async (req, res) => {
  try {
    const query = `SELECT DISTINCT id, customer_name,table_number, phone, total_amount, payment_method, created_on
      FROM orders 
      WHERE status='Completed'`;

    const [results] = await req.db.query(query);
    res.json(results);
  } catch (err) {
    console.error("Error fetching sales data:", err);
    res.status(500).send("Failed to load sales data.");
  }
});

// Fetch top products
router.get("/api/sales/top-products", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        JSON_UNQUOTE(JSON_EXTRACT(items, '$[*].name')) AS name,
        SUM(JSON_UNQUOTE(JSON_EXTRACT(items, '$[*].quantity'))) AS quantity,
        SUM(JSON_UNQUOTE(JSON_EXTRACT(items, '$[*].price')) * JSON_UNQUOTE(JSON_EXTRACT(items, '$[*].quantity'))) AS revenue
      FROM orders
      WHERE status = 'Completed'
      AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY name
      ORDER BY quantity DESC
      LIMIT 10
    `;

    const [results] = await req.db.query(query);

    const topProducts = results.map((row, index) => ({
      rank: index + 1,
      name: row.name,
      quantity: parseInt(row.quantity, 10),
      revenue: parseFloat(row.revenue),
      popularity: Math.min(100, parseInt(row.quantity, 10) * 10),
    }));

    res.json(topProducts);
  } catch (err) {
    console.error("Error fetching top products:", err);
    res.status(500).json({ message: "Database error" });
  }
});

// Fetch today's total sales
router.get("/api/sales/today-total", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT COALESCE(SUM(total_amount), 0) AS total_sales 
      FROM orders 
      WHERE status = 'Completed' 
        AND created_on >= CURDATE()
    `;

    const [results] = await req.db.query(query);
    res.json({ totalSales: results[0].total_sales });
  } catch (err) {
    console.error("Error fetching today's sales total:", err);
    res.status(500).json({ error: "Failed to load today's sales total." });
  }
});

// Fetch today's total orders
router.get("/api/orders/today-total", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT COUNT(id) AS total_orders 
      FROM orders 
      WHERE status = 'Completed' 
        AND created_on >= CURDATE()
    `;

    const [results] = await req.db.query(query);
    res.json({ totalOrders: results[0].total_orders });
  } catch (err) {
    console.error("Error fetching today's orders:", err);
    res.status(500).json({ error: "Failed to load today's orders" });
  }
});

// Fetch today's total items sold
router.get("/api/items/today-total", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(SUM(item.quantity), 0) AS total_items_sold
      FROM orders,
      JSON_TABLE(
        items,
        '$[*]' COLUMNS(
          quantity INT PATH '$.quantity'
        )
      ) AS item
      WHERE status = 'Completed'
        AND created_on >= CURDATE()
    `;

    const [results] = await req.db.query(query);
    res.json({ totalItems: results[0].total_items_sold });
  } catch (err) {
    console.error("Error fetching total items:", err);
    res.status(500).json({ error: "Failed to calculate total items" });
  }
});

// Fetch top 4 products
router.get("/api/products/top", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        item.id AS product_id,
        item.name AS product_name,
        SUM(item.quantity) AS total_sales
      FROM orders,
      JSON_TABLE(
        items,
        '$[*]' COLUMNS(
          id INT PATH '$.id',
          name VARCHAR(255) PATH '$.name',
          quantity INT PATH '$.quantity'
        )
      ) AS item
      WHERE status = 'Completed'
      AND created_on >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY item.id, item.name
      ORDER BY total_sales DESC
      LIMIT 4
    `;

    const [results] = await req.db.query(query);

    const colorPalette = [
      "info.main",
      "success.main",
      "secondary.dark",
      "warning.dark",
    ];

    const topProducts = results.map((product, index) => ({
      id: product.product_id,
      name: product.product_name,
      sales: product.total_sales,
      color: colorPalette[index] || "primary.main",
    }));

    res.json(topProducts);
  } catch (err) {
    console.error("Error fetching top products:", err);
    res.status(500).json({ error: "Failed to load top products" });
  }
});

// Fetch revenue by payment method
router.get("/api/revenue", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        DATE_FORMAT(created_on, '%W') AS day,
        SUM(CASE WHEN payment_method = 'online' THEN total_amount ELSE 0 END) AS online_sales,
        SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END) AS offline_sales
      FROM orders
      WHERE status = 'Completed'
        AND created_on >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE_FORMAT(created_on, '%W'), DAYOFWEEK(created_on)
      ORDER BY DAYOFWEEK(created_on)
    `;

    const [results] = await req.db.query(query);

    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const revenueData = {
      "Online Sales": Array(7).fill(0),
      "Offline Sales": Array(7).fill(0),
    };

    results.forEach((row) => {
      const index = daysOfWeek.indexOf(row.day);
      if (index !== -1) {
        revenueData["Online Sales"][index] = row.online_sales / 1000;
        revenueData["Offline Sales"][index] = row.offline_sales / 1000;
      }
    });

    res.json(revenueData);
  } catch (err) {
    console.error("Error fetching revenue data:", err);
    res.status(500).json({ error: "Failed to load revenue data" });
  }
});

// Fetch visitor insights
router.get("/api/visitors", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      WITH customer_first_order AS (
        SELECT 
          CONCAT(customer_name, phone) AS customer_id,
          MIN(DATE_FORMAT(created_on, '%Y-%m-01')) AS first_order_month
        FROM orders
        WHERE status = 'Completed' AND is_deleted = 0
        GROUP BY customer_name, phone
      ),
      monthly_orders AS (
        SELECT 
          DATE_FORMAT(created_on, '%Y-%m-01') AS order_month,
          CONCAT(customer_name, phone) AS customer_id
        FROM orders
        WHERE status = 'Completed' AND is_deleted = 0
        GROUP BY order_month, customer_name, phone
      )
      SELECT
        DATE_FORMAT(mo.order_month, '%M') AS month_name,
        MONTH(mo.order_month) AS month_number,
        COUNT(DISTINCT mo.customer_id) AS unique_customers,
        SUM(CASE WHEN cfo.first_order_month = mo.order_month THEN 1 ELSE 0 END) AS new_customers,
        SUM(CASE WHEN cfo.first_order_month < mo.order_month THEN 1 ELSE 0 END) AS loyal_customers
      FROM monthly_orders mo
      JOIN customer_first_order cfo ON mo.customer_id = cfo.customer_id
      WHERE mo.order_month >= DATE_SUB(CURRENT_DATE(), INTERVAL 11 MONTH)
      GROUP BY mo.order_month
      ORDER BY mo.order_month;
    `;

    const [results] = await req.db.query(query);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const visitorData = {
      'loyal customers': Array(12).fill(0),
      'new customers': Array(12).fill(0),
      'unique customers': Array(12).fill(0)
    };

    results.forEach(row => {
      const monthIndex = row.month_number - 1;
      visitorData['loyal customers'][monthIndex] = row.loyal_customers;
      visitorData['new customers'][monthIndex] = row.new_customers;
      visitorData['unique customers'][monthIndex] = row.unique_customers;
    });

    res.json(visitorData);
  } catch (err) {
    console.error("Error fetching visitor data:", err);
    res.status(500).json({ error: "Failed to load visitor insights" });
  }
});

// Fetch items report within date range
router.get("/api/items-report", authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        item.id AS item_id,
        item.name AS item_name,
        SUM(item.quantity) AS total_quantity,
        SUM(item.quantity * item.price) AS total_revenue
      FROM orders,
      JSON_TABLE(
        items,
        '$[*]' COLUMNS(
          id INT PATH '$.id',
          name VARCHAR(255) PATH '$.name',
          price DECIMAL(10,2) PATH '$.price',
          quantity INT PATH '$.quantity'
        )
      ) AS item
      WHERE status = 'Completed'
        AND created_on BETWEEN ? AND ?
      GROUP BY item.id, item.name
      ORDER BY total_quantity DESC
    `;

    const startDate = req.query.startDate || '1970-01-01';
    const endDate = req.query.endDate || '2100-12-31';

    const [results] = await req.db.query(query, [startDate, endDate]);
    res.json(results);
  } catch (err) {
    console.error("Error fetching items report:", err);
    res.status(500).json({ error: "Failed to load items report" });
  }
});

module.exports = router;
