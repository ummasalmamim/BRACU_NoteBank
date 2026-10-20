/**
 * A tiny JSON-file database.
 *
 * Everything lives in memory and is written to data/db.json after each change
 * (write to a temp file, then rename, so a crash never leaves a half-written file).
 * No native modules are needed, so `npm install` works on any Windows/Mac/Linux laptop.
 *
 * For a few thousand students and uploads this is plenty. If the platform grows
 * large, swap this file for MongoDB/PostgreSQL — the routes only use the helpers below.
 */
const fs = require('fs');
const crypto = require('crypto');
const config = require('./config');

const EMPTY = { users: [], resources: [], comments: [] };

let state = load();
let writing = false;
let pending = false;

function load() {
  fs.mkdirSync(config.paths.data, { recursive: true });
  if (!fs.existsSync(config.paths.dbFile)) return structuredClone(EMPTY);
  try {
    const parsed = JSON.parse(fs.readFileSync(config.paths.dbFile, 'utf8'));
    return { ...structuredClone(EMPTY), ...parsed };
  } catch (err) {
    console.error('Could not read data/db.json:', err.message);
    process.exit(1);
  }
}

function persist() {
  if (writing) {
    pending = true;
    return;
  }
  writing = true;
  const tmp = config.paths.dbFile + '.tmp';
  fs.writeFile(tmp, JSON.stringify(state, null, 2), (err) => {
    if (err) {
      console.error('Failed to save database:', err.message);
      writing = false;
      return;
    }
    fs.rename(tmp, config.paths.dbFile, (err2) => {
      if (err2) console.error('Failed to save database:', err2.message);
      writing = false;
      if (pending) {
        pending = false;
        persist();
      }
    });
  });
}

/** Write synchronously — used on shutdown so nothing is lost. */
function flushSync() {
  fs.writeFileSync(config.paths.dbFile, JSON.stringify(state, null, 2));
}

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  get users() {
    return state.users;
  },
  get resources() {
    return state.resources;
  },
  get comments() {
    return state.comments;
  },
  save: persist,
  flushSync,
  newId,
};
