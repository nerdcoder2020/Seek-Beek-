const express = require("express");
const router = express.Router();
const { masterPool } = require('../db/config');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode');
const { authenticateAdmin } = require('../middleware/middleware');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 20 * 1024 * 1024 // Limit file size to 20 MB
  }
});
router.get('/api/settings', authenticateAdmin, async (req, res) => {
  try {
    const query = 'SELECT * FROM settings LIMIT 1';
    const [results] = await req.db.query(query);

    if (results.length === 0) {
      const defaultSettings = {
        restaurantName: 'My Restaurant',
        address: '123 Main Street',
        phone: '123-456-7890',
        email: 'example@example.com',
        operatingHours: '9 AM - 9 PM',
        upiId: '',
        isOpen: true,
        gst: 0 // Default GST value
      };

      const insertQuery = `
        INSERT INTO settings (restaurantName, address, phone, email, operatingHours, upiId, isOpen, gst)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [insertResult] = await req.db.query(insertQuery, [
        defaultSettings.restaurantName,
        defaultSettings.address,
        defaultSettings.phone,
        defaultSettings.email,
        defaultSettings.operatingHours,
        defaultSettings.upiId,
        defaultSettings.isOpen,
        defaultSettings.gst
      ]);

      defaultSettings.id = insertResult.insertId;
      res.json(defaultSettings);
    } else {
      res.json(results[0]);
    }
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).send('Database error');
  }
});

// PUT settings API
router.put('/api/settings', authenticateAdmin, async (req, res) => {
  try {
    const { restaurantName, address, phone, email, operatingHours, upiId, isOpen, gst } = req.body;
    const query = `
      UPDATE settings
      SET restaurantName = ?, address = ?, phone = ?, email = ?, operatingHours = ?, upiId = ?, isOpen = ?, gst = ?
      WHERE id = 1
    `;
    await req.db.query(query, [
      restaurantName,
      address,
      phone,
      email,
      operatingHours,
      upiId,
      isOpen,
      gst || 0 // Ensure gst is provided, default to 0 if not
    ]);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).send('Database error');
  }
});


// Generate QR code for restaurant
router.get('/api/generate-qr', authenticateAdmin, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  let connection;

  try {
    if (!process.env.WEB_URL) {
      throw new Error('WEB_URL environment variable not configured');
    }

    const [settings] = await req.db.query(`
      SELECT restaurantName, address, upiId 
      FROM settings 
      LIMIT 1
    `);

    if (!settings?.length) {
      return res.status(404).json({
        error: 'Restaurant settings not found',
        solution: 'Configure restaurant settings first',
      });
    }

    const restaurant = settings[0];

    if (!restaurant.restaurantName || !restaurant.address) {
      throw new Error('Incomplete restaurant information in settings');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    connection = await masterPool.getConnection(); // Assuming masterPool is available via req
    const [rows] = await connection.query(
      `SELECT id FROM admins WHERE db_name = ?`,
      [decoded.dbName]
    );

    if (!rows || rows.length === 0) {
      throw new Error('No restaurant found for this database');
    }

    const restaurantId = rows[0].id;
    if (!Number.isInteger(restaurantId)) {
      throw new Error('Invalid restaurant ID format');
    }

    const url = new URL(`${process.env.WEB_URL}/welcome`);
    url.searchParams.set('restaurant_id', restaurantId);

    // Generate QR code as a buffer
    const qrBuffer = await qrcode.toBuffer(url.toString(), {
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 8,
    });

    // Upload to Supabase Storage
    const fileName = `restaurant_${restaurantId}.png`;
    const { data, error } = await supabase.storage
      .from('qr-codes') // Your bucket name
      .upload(fileName, qrBuffer, {
        contentType: 'image/png',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      throw new Error(`Failed to upload QR code to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('qr-codes')
      .getPublicUrl(fileName);

    const qrImageUrl = publicUrlData.publicUrl;

    res.json({
      qrImage: qrImageUrl, // e.g., https://your-project-ref.supabase.co/storage/v1/object/public/qr-codes/restaurant_1.png
      restaurantName: restaurant.restaurantName,
      address: restaurant.address,
      upiId: restaurant.upiId,
    });

  } catch (error) {
    console.error('[QR Generation Error]', {
      message: error.message,
      stack: error.stack,
      adminId: req.admin?.id,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      error: 'QR generation failed',
      debugInfo: process.env.NODE_ENV === 'development'
        ? {
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    });
  } finally {
    if (connection) connection.release();
  }
});


router.get('/api/restaurant-name', authenticateAdmin, async (req, res) => {
  try {
    const [results] = await req.db.query(
      'SELECT restaurantName FROM settings LIMIT 1'
    );
    
    res.json({
      name: results[0]?.restaurantName || 'Our Restaurant'
    });
  } catch (err) {
    console.error('Error fetching restaurant name:', err);
    res.status(500).json({ name: 'Our Restaurant' });
  }
});

router.post('/api/upload-profile-photo', 
  authenticateAdmin,
  upload.single('profileImage'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send('Profile image is required');
    }

    try {
      const { buffer, mimetype } = req.file;

      const updateQuery = `
        UPDATE settings 
        SET profile_photo_data = ?, profile_photo_mime = ?
        WHERE id = 1
      `;
      await req.db.query(updateQuery, [buffer, mimetype]);

      // Convert to base64 for immediate response
      const photoData = buffer.toString('base64');
      const photoUrl = `data:${mimetype};base64,${photoData}`;

      res.json({
        message: 'Profile photo updated successfully',
        profilePhoto: photoUrl
      });

    } catch (err) {
      console.error('Profile upload error:', err);
      res.status(500).send('Error uploading profile photo');
    }
  }
);

router.get('/api/user/profile', authenticateAdmin, async (req, res) => {
  try {
    const [user] = await req.db.query(
      'SELECT restaurantName, profile_photo_data, profile_photo_mime FROM settings WHERE id = 1'
    );
    
    let photoUrl = null;
    if (user[0]?.profile_photo_data) {
      const photoData = user[0].profile_photo_data.toString('base64');
      photoUrl = `data:${user[0].profile_photo_mime};base64,${photoData}`;
    }

    res.json({
      name: user[0].restaurantName,
      photoUrl: photoUrl
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});
  
module.exports = router;
