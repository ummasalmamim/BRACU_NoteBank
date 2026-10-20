const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

const COOKIE = 'nb_session';
const SESSION_DAYS = 30;

function setSession(res, user) {
  const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProduction });
}

function isAdmin(user) {
  return Boolean(user && config.adminEmails.includes(user.email));
}

/** Adds req.user when a valid session cookie is present. Never blocks. */
function attachUser(req, _res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      const { uid } = jwt.verify(token, config.jwtSecret);
      const user = db.users.find((u) => u.id === uid);
      if (user) req.user = user;
    } catch {
      /* expired or tampered cookie: treat as signed out */
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in to do that.' });
  next();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    department: user.department || '',
    createdAt: user.createdAt,
    isAdmin: isAdmin(user),
  };
}

/** Very small in-memory rate limiter (per IP). Good enough for login/register. */
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: message });
    next();
  };
}

module.exports = { setSession, clearSession, attachUser, requireAuth, publicUser, isAdmin, rateLimit };
