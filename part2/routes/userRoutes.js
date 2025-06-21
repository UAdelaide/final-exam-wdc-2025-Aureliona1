const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all users (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, username, email, role FROM Users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST a new user (simple signup)
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [username, email, password, role]);

    // @ts-ignore
    res.status(201).json({ message: 'User registered', user_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', (req, res) => {
  // @ts-ignore
  if (!req.session.user) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }
  // @ts-ignore
  res.json(req.session.user);
});

// POST login (dummy version)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query(`
      SELECT user_id, username, role FROM Users
      WHERE username = ? AND password_hash = ?
    `, [username, password]);

    // @ts-ignore
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // @ts-ignore
    req.session.user = rows[0];
    res.json({ message: 'Login successful', user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get("/logout", async (req, res) => {
  req.session.destroy((e) => {
    if (e) {
      console.log(e);
      res.sendStatus(500);
    }
    res.clearCookie("connect.sid");
    res.sendStatus(200);
  });
});

router.get("/dogs", async (req, res) => {
  const id = req.session.user.user_id;
  const [rows] = await db.query("SELECT * FROM ")
})

module.exports = router;