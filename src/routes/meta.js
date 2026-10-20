const express = require('express');
const config = require('../config');
const db = require('../db');
const { RESOURCE_TYPES, SEASONS, ALLOWED_EXTENSIONS } = require('../validate');

const router = express.Router();

/** Picks the most common value, so one typo doesn't rename a whole course. */
function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function group(keyFn, nameFn) {
  const map = new Map();
  for (const r of db.resources) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()].map(([key, list]) => ({ key, name: mostCommon(list.map(nameFn)), count: list.length }));
}

router.get('/', (_req, res) => {
  const courses = group((r) => r.courseCode, (r) => r.courseName)
    .map((c) => ({ code: c.key, name: c.name, count: c.count }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const faculties = group((r) => r.facultyInitials, (r) => r.facultyName)
    .map((f) => ({ initials: f.key, name: f.name, count: f.count }))
    .sort((a, b) => a.initials.localeCompare(b.initials));

  const order = { Spring: 1, Summer: 2, Fall: 3 };
  const semesters = [...new Set(db.resources.map((r) => r.semester))].sort((a, b) => {
    const [sa, ya] = a.split(' ');
    const [sb, yb] = b.split(' ');
    return Number(yb) * 10 + order[sb] - (Number(ya) * 10 + order[sa]);
  });

  res.json({
    types: RESOURCE_TYPES,
    seasons: SEASONS,
    allowedExtensions: ALLOWED_EXTENSIONS,
    maxUploadMB: Math.round(config.maxUploadBytes / 1024 / 1024),
    emailDomain: config.allowedEmailDomain,
    courses,
    faculties,
    semesters,
    stats: {
      resources: db.resources.length,
      courses: courses.length,
      contributors: new Set(db.resources.map((r) => r.uploaderId)).size,
    },
  });
});

module.exports = router;
