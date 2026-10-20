const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const db = require('../db');
const { requireAuth, isAdmin } = require('../auth');
const { parseResource, normalizeCourseCode, ALLOWED_EXTENSIONS, clean } = require('../validate');

const router = express.Router();
const PAGE_SIZE = 20;
const INLINE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mp3'];

// ---------- uploads ----------

fs.mkdirSync(config.paths.uploads, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: config.paths.uploads,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    },
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) return cb(null, true);
    const err = new Error(`Files of type "${ext || 'unknown'}" can't be uploaded. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
    err.status = 400;
    cb(err);
  },
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(413)
        .json({ error: `File is larger than ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB. For big videos, upload to YouTube or Google Drive and paste the link instead.` });
    }
    res.status(err.status || 400).json({ error: err.message });
  });
}

function removeStoredFile(storedName) {
  if (!storedName) return;
  fs.unlink(path.join(config.paths.uploads, path.basename(storedName)), () => {});
}

// ---------- helpers ----------

function serialize(resource, viewer) {
  const uploader = db.users.find((u) => u.id === resource.uploaderId);
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    courseCode: resource.courseCode,
    courseName: resource.courseName,
    facultyName: resource.facultyName,
    facultyInitials: resource.facultyInitials,
    semester: resource.semester,
    season: resource.season,
    year: resource.year,
    type: resource.type,
    link: resource.link,
    file: resource.file
      ? {
          name: resource.file.originalName,
          size: resource.file.size,
          ext: path.extname(resource.file.originalName).toLowerCase(),
          previewable: INLINE_EXTENSIONS.includes(path.extname(resource.file.storedName).toLowerCase()),
        }
      : null,
    uploader: uploader ? { id: uploader.id, name: uploader.name } : { id: null, name: 'Deleted user' },
    createdAt: resource.createdAt,
    downloads: resource.downloads || 0,
    votes: resource.votes.length,
    voted: Boolean(viewer && resource.votes.includes(viewer.id)),
    commentCount: db.comments.filter((c) => c.resourceId === resource.id).length,
    canDelete: Boolean(viewer && (viewer.id === resource.uploaderId || isAdmin(viewer))),
  };
}

function findResource(req, res) {
  const resource = db.resources.find((r) => r.id === req.params.id);
  if (!resource) res.status(404).json({ error: 'This resource no longer exists.' });
  return resource;
}

function semesterRank(r) {
  const order = { Spring: 1, Summer: 2, Fall: 3 };
  return r.year * 10 + (order[r.season] || 0);
}

// ---------- routes ----------

// List + search + filter
router.get('/', (req, res) => {
  const q = clean(req.query.q, 100).toLowerCase();
  const course = normalizeCourseCode(req.query.course || '');
  const faculty = clean(req.query.faculty, 6).toUpperCase();
  const semester = clean(req.query.semester, 20);
  const type = clean(req.query.type, 20);
  const sort = clean(req.query.sort, 20) || 'new';
  const mine = req.query.mine === '1';
  const page = Math.max(1, Number(req.query.page) || 1);

  if (mine && !req.user) return res.status(401).json({ error: 'Sign in to see your uploads.' });

  const terms = q.split(' ').filter(Boolean);

  let list = db.resources.filter((r) => {
    if (course && r.courseCode !== course) return false;
    if (faculty && r.facultyInitials !== faculty) return false;
    if (semester && r.semester !== semester) return false;
    if (type && r.type !== type) return false;
    if (mine && r.uploaderId !== req.user.id) return false;
    if (terms.length) {
      const haystack = [
        r.title, r.description, r.courseCode, r.courseName, r.facultyName, r.facultyInitials, r.semester,
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((t) => haystack.includes(t));
    }
    return true;
  });

  const sorters = {
    new: (a, b) => b.createdAt.localeCompare(a.createdAt),
    top: (a, b) => b.votes.length - a.votes.length || (b.downloads || 0) - (a.downloads || 0),
    downloads: (a, b) => (b.downloads || 0) - (a.downloads || 0),
    semester: (a, b) => semesterRank(b) - semesterRank(a) || b.createdAt.localeCompare(a.createdAt),
  };
  list.sort(sorters[sort] || sorters.new);

  const total = list.length;
  list = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  res.json({
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: list.map((r) => serialize(r, req.user)),
  });
});

router.get('/:id', (req, res) => {
  const resource = findResource(req, res);
  if (!resource) return;
  res.json({ item: serialize(resource, req.user) });
});

// Create (multipart form: fields + optional "file")
router.post('/', requireAuth, handleUpload, (req, res) => {
  const parsed = parseResource(req.body);
  if (parsed.error) {
    if (req.file) removeStoredFile(req.file.filename);
    return res.status(400).json({ error: parsed.error });
  }
  if (!req.file && !parsed.value.link) {
    return res.status(400).json({ error: 'Attach a file or paste a link (YouTube, Google Drive, etc.).' });
  }

  const resource = {
    id: db.newId(),
    ...parsed.value,
    file: req.file
      ? { storedName: req.file.filename, originalName: clean(req.file.originalname, 200), size: req.file.size }
      : null,
    uploaderId: req.user.id,
    createdAt: new Date().toISOString(),
    downloads: 0,
    votes: [],
  };
  db.resources.push(resource);
  db.save();
  res.status(201).json({ item: serialize(resource, req.user) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const resource = findResource(req, res);
  if (!resource) return;
  if (resource.uploaderId !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Only the uploader can delete this.' });
  }
  db.resources.splice(db.resources.indexOf(resource), 1);
  for (let i = db.comments.length - 1; i >= 0; i--) {
    if (db.comments[i].resourceId === resource.id) db.comments.splice(i, 1);
  }
  if (resource.file) removeStoredFile(resource.file.storedName);
  db.save();
  res.json({ ok: true });
});

// Toggle "helpful" vote
router.post('/:id/vote', requireAuth, (req, res) => {
  const resource = findResource(req, res);
  if (!resource) return;
  const i = resource.votes.indexOf(req.user.id);
  if (i === -1) resource.votes.push(req.user.id);
  else resource.votes.splice(i, 1);
  db.save();
  res.json({ votes: resource.votes.length, voted: i === -1 });
});

// Download or preview the attached file
router.get('/:id/file', (req, res) => {
  const resource = findResource(req, res);
  if (!resource) return;
  if (!resource.file) return res.status(404).json({ error: 'This resource has no attached file.' });

  const storedName = path.basename(resource.file.storedName);
  const filePath = path.join(config.paths.uploads, storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'The file is missing on the server.' });

  const ext = path.extname(storedName).toLowerCase();
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.query.inline === '1' && INLINE_EXTENSIONS.includes(ext)) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'");
    return res.sendFile(filePath, { headers: { 'Content-Disposition': 'inline' } });
  }

  resource.downloads = (resource.downloads || 0) + 1;
  db.save();
  res.download(filePath, resource.file.originalName);
});

// ---------- comments ----------

router.get('/:id/comments', (req, res) => {
  const resource = findResource(req, res);
  if (!resource) return;
  const items = db.comments
    .filter((c) => c.resourceId === resource.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((c) => {
      const author = db.users.find((u) => u.id === c.userId);
      return {
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        author: author ? author.name : 'Deleted user',
        canDelete: Boolean(req.user && (req.user.id === c.userId || isAdmin(req.user))),
      };
    });
  res.json({ items });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const resource = findResource(req, res);
  if (!resource) return;
  const text = String(req.body.text || '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Write something before posting.' });
  const comment = {
    id: db.newId(),
    resourceId: resource.id,
    userId: req.user.id,
    text,
    createdAt: new Date().toISOString(),
  };
  db.comments.push(comment);
  db.save();
  res.status(201).json({ ok: true });
});

router.delete('/:id/comments/:commentId', requireAuth, (req, res) => {
  const i = db.comments.findIndex((c) => c.id === req.params.commentId && c.resourceId === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Comment not found.' });
  const comment = db.comments[i];
  if (comment.userId !== req.user.id && !isAdmin(req.user)) {
    return res.status(403).json({ error: 'You can only delete your own comments.' });
  }
  db.comments.splice(i, 1);
  db.save();
  res.json({ ok: true });
});

module.exports = router;
