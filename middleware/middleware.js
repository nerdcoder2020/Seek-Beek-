const jwt = require('jsonwebtoken');
const { pool } = require('../db/config');

const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Verify JWT and get database name
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const connection = await pool.getConnection();

    // Switch to admin's database
    await connection.query(`USE ??`, [decoded.dbName]);
    req.db = connection; // Attach connection to request
    
    // Release connection after response
    res.on('finish', () => connection.release());
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticateAdmin };