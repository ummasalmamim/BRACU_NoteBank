/** Shared rules for what a resource can contain. The frontend fetches these via /api/meta. */

const RESOURCE_TYPES = [
  { id: 'notes', label: 'Notes' },
  { id: 'slides', label: 'Slides' },
  { id: 'video', label: 'Video' },
  { id: 'book', label: 'Book' },
  { id: 'questions', label: 'Past questions' },
  { id: 'assignment', label: 'Assignment / lab' },
  { id: 'other', label: 'Other' },
];

const SEASONS = ['Spring', 'Summer', 'Fall'];

const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md',
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.zip', '.rar', '.7z',
  '.mp4', '.webm', '.mkv', '.mp3',
  '.py', '.ipynb', '.java', '.c', '.cpp', '.js', '.html', '.css', '.sql',
  '.epub',
];

function clean(value, max = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeCourseCode(value) {
  return clean(value, 20).toUpperCase().replace(/[\s-]/g, '');
}

/** Returns { value } or { error }. */
function parseResource(body) {
  const title = clean(body.title, 140);
  const description = String(body.description ?? '').trim().slice(0, 3000);
  const courseCode = normalizeCourseCode(body.courseCode);
  const courseName = clean(body.courseName, 120);
  const facultyName = clean(body.facultyName, 100);
  const facultyInitials = clean(body.facultyInitials, 6).toUpperCase().replace(/[^A-Z]/g, '');
  const season = clean(body.season, 10);
  const year = Number(body.year);
  const type = clean(body.type, 20);
  const link = clean(body.link, 500);

  if (title.length < 3) return { error: 'Give the resource a title (at least 3 characters).' };
  if (!/^[A-Z]{3}\d{3}[A-Z]?$/.test(courseCode))
    return { error: 'Course code should look like CSE110 or MAT120.' };
  if (courseName.length < 2) return { error: 'Add the course name, for example "Programming Language I".' };
  if (facultyName.length < 2) return { error: "Add the faculty member's name." };
  if (!/^[A-Z]{2,5}$/.test(facultyInitials))
    return { error: 'Faculty initials should be 2–5 letters, for example "ARF".' };
  if (!SEASONS.includes(season)) return { error: 'Pick Spring, Summer or Fall for the semester.' };
  const thisYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > thisYear + 1)
    return { error: `Semester year should be between 2000 and ${thisYear + 1}.` };
  if (!RESOURCE_TYPES.some((t) => t.id === type)) return { error: 'Pick a resource type.' };

  let safeLink = '';
  if (link) {
    try {
      const url = new URL(link);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
      safeLink = url.toString();
    } catch {
      return { error: 'The link must be a full web address starting with https://' };
    }
  }

  return {
    value: {
      title,
      description,
      courseCode,
      courseName,
      facultyName,
      facultyInitials,
      semester: `${season} ${year}`,
      season,
      year,
      type,
      link: safeLink,
    },
  };
}

module.exports = {
  RESOURCE_TYPES,
  SEASONS,
  ALLOWED_EXTENSIONS,
  clean,
  normalizeCourseCode,
  parseResource,
};
