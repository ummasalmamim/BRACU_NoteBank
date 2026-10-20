const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./src/config');
const db = require('./src/db');
const { attachUser } = require('./src/auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx

// Basic security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(attachUser);

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/resources', require('./src/routes/resources'));
app.use('/api/meta', require('./src/routes/meta'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

// Frontend (single page app with #/routes)
app.use(express.static(config.paths.public));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
});

const server = app.listen(config.port, () => {
  console.log(`BRACU NoteBank running at http://localhost:${config.port}`);
  if (!config.allowedEmailDomain) console.log('Note: sign-ups are open to any email (ALLOWED_EMAIL_DOMAIN is empty).');
});

function shutdown() {
  db.flushSync();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
