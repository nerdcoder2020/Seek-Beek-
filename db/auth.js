const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connection = require('./config');
require('dotenv').config();

// Function to authenticate the user and generate JWT
const loginUser = (email, password, res) => {
  // Find user by email
  connection.query('SELECT * FROM Login WHERE email = ? AND is_deleted = 0', [email], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0];

    // Compare the password with the hashed password stored in the database
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        return res.status(500).json({ message: 'Error comparing passwords', error: err });
      }

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const payload = { id: user.id, email: user.email, role_id: user.role_id };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      return res.status(200).json({ message: 'Login successful', token });
    });
  });
};

// Function to hash password before saving
const hashPassword = (password) => {
  return bcrypt.hash(password, 10);
};

// Function to register a new user
const signupUser = (email, password, role_id, res) => {
  // Check if the email already exists
  connection.query('SELECT * FROM Login WHERE email = ? AND is_deleted = 0', [email], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Hash the password
    hashPassword(password).then((hashedPassword) => {
      // Insert the new user into the Login table
      const query = `INSERT INTO Login (email, password, role_id, created_on, modified_on, is_deleted) 
                     VALUES (?, ?, ?, NOW(), NOW(), 0)`;

      connection.query(query, [email, hashedPassword, role_id], (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error saving user to the database', error: err });
        }

        // Successfully registered the user
        return res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
      });
    }).catch((err) => {
      return res.status(500).json({ message: 'Error hashing password', error: err });
    });
  });
};

module.exports = { loginUser, signupUser, hashPassword };
