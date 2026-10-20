const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../db');
const { setSession, clearSession, publicUser, rateLimit } = require('../auth');
const { clean } = require('../validate');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many attempts. Wait 15 minutes and try again.',
});

router.post('/register', authLimiter, async (req, res) => {
  const name = clean(req.body.name, 80);
  const email = clean(req.body.email, 120).toLowerCase();
  const department = clean(req.body.department, 60);
  const password = String(req.body.password || '');

  if (name.length < 2) return res.status(400).json({ error: 'Enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Enter a valid email address.' });
  if (config.allowedEmailDomain && !email.endsWith('@' + config.allowedEmailDomain))
    return res
      .status(400)
      .json({ error: `Use your BRACU email (ending in @${config.allowedEmailDomain}).` });
  if (password.length < 8) return res.status(400).json({ error: 'Password needs at least 8 characters.' });
  if (db.users.some((u) => u.email === email))
    return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });

  const user = {
    id: db.newId(),
    name,
    email,
    department,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  db.save();
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = clean(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const user = db.users.find((u) => u.email === email);
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
