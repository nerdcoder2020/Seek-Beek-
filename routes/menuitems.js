const express = require('express');
const router = express.Router();
// const connection = require('../db/config');
const { authenticateAdmin } = require('../middleware/middleware');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Configure multer to handle file in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 20 * 1024 * 1024 // Limit file size to 20 MB
  }
});

// API to fetch all menu items (protected)
router.get('/api/menuitems', authenticateAdmin, async (req, res) => {
  try {
    const [results] = await req.db.query('SELECT * FROM MenuItems');
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

// API to add a new menu item (protected)
router.post('/api/add-menuitem', authenticateAdmin, upload.single('image'), async (req, res) => {
  const { name, category } = req.body;
  
  if (!name || !category || !req.file) {
    return res.status(400).send('Name, category, and image are required.');
  }

  try {
    // Generate unique filename
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    // Upload image to Supabase Storage
    const { data, error } = await supabase.storage
      .from('menu_items')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('menu_items')
      .getPublicUrl(fileName);

    // Store in database
    const query = 'INSERT INTO MenuItems (name, category, image) VALUES (?, ?, ?)';
    await req.db.query(query, [name, category, urlData.publicUrl]);

    res.json({ 
      message: 'Menu item added successfully',
      imageUrl: urlData.publicUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error uploading file');
  }
});

// API to delete a menu item (protected)
router.delete('/api/remove-itemofmenu/:id', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    // First get the image URL
    const [results] = await req.db.query('SELECT image FROM MenuItems WHERE id = ?', [id]);
    
    if (results.length === 0) {
      return res.status(404).send('Item not found');
    }

    const imageUrl = results[0].image;
    
    // Extract filename from URL
    const fileName = imageUrl.split('/').pop();

    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('menu_items')
      .remove([fileName]);

    if (storageError) throw storageError;

    // Delete from database
    await req.db.query('DELETE FROM MenuItems WHERE id = ?', [id]);

    res.json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting item');
  }
});

module.exports = router;