const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/middleware');

// Add a new section
router.post('/api/sections', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Section name is required' });
    }

    const query = 'INSERT INTO sections (name) VALUES (?)';
    const [result] = await req.db.query(query, [name]);
    
    const newSection = {
      id: result.insertId,
      name,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    req.wss.broadcast({ type: 'new_section', section: newSection });
    res.status(201).json({ message: 'Section added successfully', sectionId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Section name already exists' });
    }
    console.error('Error adding section:', err);
    res.status(500).send('Database error');
  }
});

// Get all sections
router.get('/api/sections', authenticateAdmin, async (req, res) => {
  try {
    const query = 'SELECT * FROM sections ORDER BY name ASC';
    const [results] = await req.db.query(query);
    res.json(results);
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).send('Database error');
  }
});
// Assuming authenticateAdmin and req.db are set up elsewhere
router.delete('/api/sections/:id', authenticateAdmin, async (req, res) => {
  try {
    const sectionId = req.params.id;

    // Log the sectionId for debugging
    console.log('Attempting to delete section with ID:', sectionId);

    // Check if section exists
    const [sectionResult] = await req.db.query('SELECT * FROM sections WHERE id = ?', [sectionId]);
    if (sectionResult.length === 0) {
      return res.status(404).json({ message: 'Section not found' });
    }

    // Start a transaction to ensure atomicity
    await req.db.query('START TRANSACTION');

    // Delete orders tied to tables in this section
    await req.db.query(
      'DELETE o FROM orders o JOIN tables t ON o.table_number = t.table_number AND o.section_id = t.section_id WHERE t.section_id = ?',
      [sectionId]
    );

    // Delete tables in this section
    await req.db.query('DELETE FROM tables WHERE section_id = ?', [sectionId]);

    // Delete the section
    const [result] = await req.db.query('DELETE FROM sections WHERE id = ?', [sectionId]);
    if (result.affectedRows === 0) {
      await req.db.query('ROLLBACK');
      return res.status(404).json({ message: 'Section not found' });
    }

    // Commit the transaction
    await req.db.query('COMMIT');

    // Broadcast deletion via WebSocket
    req.wss.broadcast({
      type: 'delete_section',
      id: Number(sectionId), // Ensure it’s a number to match frontend
    });

    res.status(204).send();
  } catch (err) {
    // Rollback on error
    await req.db.query('ROLLBACK');
    console.error('Error deleting section:', {
      message: err.message,
      code: err.code,
      stack: err.stack,
      sql: err.sql,
    });
    res.status(500).json({
      message: 'Database error',
      error: err.message,
    });
  }
});

// Add a new table
router.post('/api/tables', authenticateAdmin, async (req, res) => {
  try {
    const { table_number, status, section_id } = req.body;

    if (!table_number || !section_id) {
      return res.status(400).json({ message: 'Table number and section are required' });
    }

    const [existing] = await req.db.query(
      'SELECT id FROM tables WHERE table_number = ? AND section_id = ?',
      [table_number, section_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Table number already exists in this section' });
    }

    const query = `
      INSERT INTO tables (table_number, status, section_id)
      VALUES (?, ?, ?)
    `;
    const [result] = await req.db.query(query, [
      table_number,
      status || 'empty',
      section_id,
    ]);

    const [section] = await req.db.query('SELECT name FROM sections WHERE id = ?', [section_id]);
    const newTable = {
      id: result.insertId,
      table_number,
      status: status || 'empty',
      section: section[0].name,
      section_id,
      created_at: new Date(),
      updated_at: new Date(),
    };
    req.wss.broadcast({ type: 'new_table', table: newTable });
    res.status(201).json({ message: 'Table added successfully', tableId: result.insertId });
  } catch (err) {
    console.error('Error adding table:', err);
    res.status(500).send('Database error');
  }
});

// Fetch all tables
router.get('/api/tables', authenticateAdmin, async (req, res) => {
  try {
    const query = `
      SELECT t.*, s.name as section 
      FROM tables t 
      JOIN sections s ON t.section_id = s.id 
      ORDER BY s.name, t.table_number ASC
    `;
    const [results] = await req.db.query(query);

    const processedResults = results.map((table) => ({
      id: table.id,
      table_number: table.table_number,
      status: table.status,
      section: table.section,
      section_id: table.section_id,
      created_at: table.created_at,
      updated_at: table.updated_at,
    }));

    res.json(processedResults);
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).send('Database error');
  }
});

// Update a table
router.put('/api/tables/:id', authenticateAdmin, async (req, res) => {
  try {
    const tableId = req.params.id;
    const { status, section_id } = req.body;

    if (!status && !section_id) {
      return res.status(400).json({ message: 'Status or section is required' });
    }

    const [section] = await req.db.query('SELECT name FROM sections WHERE id = ?', [section_id]);
    if (!section.length) {
      return res.status(400).json({ message: 'Invalid section ID' });
    }

    const query = 'UPDATE tables SET status = ?, section_id = ? WHERE id = ?';
    const [result] = await req.db.query(query, [
      status || 'empty',
      section_id,
      tableId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }

    const updatedTable = { 
      id: tableId, 
      status, 
      section: section[0].name,
      section_id 
    };
    req.wss.broadcast({ type: 'update_table', table: updatedTable });
    res.json({ message: 'Table updated successfully' });
  } catch (err) {
    console.error('Error updating table:', err);
    res.status(500).send('Database error');
  }
});

// Delete a table
router.delete('/api/tables/:id', authenticateAdmin, async (req, res) => {
  try {
    const tableId = req.params.id;

    // Fetch table details before deletion
    const [tableResult] = await req.db.query(
      `
      SELECT t.id, t.table_number, t.section_id, s.name AS section 
      FROM tables t 
      JOIN sections s ON t.section_id = s.id 
      WHERE t.id = ?
    `,
      [tableId]
    );

    if (tableResult.length === 0) {
      return res.status(404).json({ message: 'Table not found' });
    }

    const table = tableResult[0];

    // Delete associated orders first (assuming orders table has table_number and section_id)
    await req.db.query(
      'DELETE FROM orders WHERE table_number = ? AND section_id = ?',
      [table.table_number, table.section_id]
    );

    // Delete the table
    const [deleteResult] = await req.db.query('DELETE FROM tables WHERE id = ?', [tableId]);
    if (deleteResult.affectedRows === 0) {
      return res.status(500).json({ message: 'Failed to delete table' });
    }

    // Broadcast the deletion via WebSocket
    req.wss.broadcast({
      type: 'delete_table',
      id: Number(tableId), // Match frontend expectation of data.id
      table_number: table.table_number, // Optional: for order filtering
      section_id: table.section_id, // Optional: for order filtering
    });

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting table:', err);
    res.status(500).json({ message: 'Database error' });
  }
});

module.exports = router;