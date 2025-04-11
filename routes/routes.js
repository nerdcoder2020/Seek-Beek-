const express = require('express');
// const { loginUser, signupUser } = require('../db/auth');
const { v4: uuidv4 } = require("uuid");
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
// const mysql = require('mysql2/promise');
const { pool, masterPool } = require('../db/config');
const { authenticateAdmin } = require('../middleware/middleware');
const router = express.Router();

// Initialize admin database with schema.sql
async function initializeAdminDatabase(dbName) {
  const connection = await pool.getConnection();
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
    await connection.query(`USE ??`, [dbName]);

    // Execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    const statements = schemaSql.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      await connection.query(stmt);
    }
  } finally {
    connection.release();
  }
}

// Admin Registration
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const dbName = `admin_${uuidv4().replace(/-/g, '')}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to master_db.admins
    await masterPool.query(
      'INSERT INTO admins (username, email, password, db_name) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, dbName]
    );

    await initializeAdminDatabase(dbName);
    res.status(201).json({ message: 'Admin registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check credentials in master_db.admins
    const [rows] = await masterPool.query(
      'SELECT * FROM admins WHERE email = ?',
      [email]
    );
    
    if (!rows.length) return res.status(404).json({ message: 'Admin not found' });
    const admin = rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate JWT with database name
    const token = jwt.sign(
      { id: admin.id, dbName: admin.db_name },
      process.env.JWT_SECRET,
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

router.post('/employee/login', async (req, res) => {
  const { email, password } = req.body;
  const { restaurant_id } = req.query;

  try {
    // 1. Get restaurant database name from master DB
    const [admin] = await masterPool.query(
      'SELECT db_name FROM admins WHERE id = ?',
      [restaurant_id]
    );
    if (!admin || admin.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // 2. Connect to restaurant's database
    const restaurantDb = await pool.getConnection();
    await restaurantDb.query(`USE ??`, [admin[0].db_name]);

    const [rows] = await restaurantDb.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) return res.status(404).json({ message: 'Employee not found' });
    const Admin = rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, Admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

    // Generate JWT with database name
    const token = jwt.sign(
      { id: admin.id, dbName: admin.db_name },
      process.env.JWT_SECRET,
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});


router.post('/employee/register',authenticateAdmin, async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // const dbName = `admin_${uuidv4().replace(/-/g, '')}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to master_db.admins
    await req.db.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'Employee registered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

module.exports = router;