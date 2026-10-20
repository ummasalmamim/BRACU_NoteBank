/**
 * Adds a demo account and a few sample resources so you can see how the site looks.
 * Run once:  npm run seed
 * Demo login: demo@g.bracu.ac.bd / demo12345
 * Delete data/db.json to start fresh.
 */
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const EMAIL = 'demo@g.bracu.ac.bd';

let user = db.users.find((u) => u.email === EMAIL);
if (!user) {
  user = {
    id: db.newId(),
    name: 'Demo Student',
    email: EMAIL,
    department: 'CSE',
    passwordHash: bcrypt.hashSync('demo12345', 10),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
}

const samples = [
  ['CSE110', 'Programming Language I', 'Demo Faculty One', 'DFO', 'Fall', 2025, 'notes', 'Loops and lists cheat sheet', 'Every loop pattern from the first six lectures on one page, with worked tracing examples.', 'https://docs.google.com/'],
  ['CSE110', 'Programming Language I', 'Demo Faculty One', 'DFO', 'Spring', 2026, 'questions', 'Mid-term questions with solutions', 'Set A and Set B, solved step by step.', 'https://drive.google.com/'],
  ['CSE111', 'Programming Language II', 'Demo Faculty Two', 'DFT', 'Spring', 2026, 'video', 'OOP inheritance explained', 'A 40-minute walkthrough of inheritance and method overriding in Python.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['MAT120', 'Integral Calculus and Differential Equations', 'Demo Faculty Three', 'DFH', 'Summer', 2025, 'slides', 'Integration by parts — lecture slides', 'Slides from weeks 3 and 4.', 'https://drive.google.com/'],
  ['CSE220', 'Data Structures', 'Demo Faculty Two', 'DFT', 'Fall', 2025, 'book', 'Recommended textbook chapters', 'Which chapters map to which lecture, plus the library call number.', 'https://drive.google.com/'],
  ['PHY111', 'Principles of Physics I', 'Demo Faculty Four', 'DFF', 'Spring', 2026, 'assignment', 'Lab report template', 'The format our section was asked to follow, with a filled example.', 'https://docs.google.com/'],
];

const now = Date.now();
samples.forEach((s, i) => {
  const [courseCode, courseName, facultyName, facultyInitials, season, year, type, title, description, link] = s;
  if (db.resources.some((r) => r.title === title)) return;
  db.resources.push({
    id: db.newId(),
    title,
    description: description + '\n\n(Demo entry — delete it once real uploads arrive.)',
    courseCode,
    courseName,
    facultyName,
    facultyInitials,
    semester: `${season} ${year}`,
    season,
    year,
    type,
    link,
    file: null,
    uploaderId: user.id,
    createdAt: new Date(now - i * 3600_000).toISOString(),
    downloads: 0,
    votes: [],
  });
});

db.flushSync();
console.log(`Seeded. Sign in with ${EMAIL} / demo12345`);
