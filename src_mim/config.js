const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
// Where db.json and uploads are kept. Point this at a persistent disk when hosting.
const STORAGE = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : ROOT;

const config = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase(),
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  maxUploadBytes: (Number(process.env.MAX_UPLOAD_MB) || 50) * 1024 * 1024,
  isProduction: process.env.NODE_ENV === 'production',
  paths: {
    root: ROOT,
    data: path.join(STORAGE, 'data'),
    dbFile: path.join(STORAGE, 'data', 'db.json'),
    uploads: path.join(STORAGE, 'uploads'),
    public: path.join(ROOT, 'public'),
  },
};

if (config.isProduction && config.jwtSecret === 'dev-only-secret-change-me') {
  console.error('JWT_SECRET is not set. Set it in .env before running in production.');
  process.exit(1);
}

module.exports = config;
