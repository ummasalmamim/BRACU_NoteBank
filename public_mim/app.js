/* NoteBank frontend — plain JavaScript, no build step.
   Routes live in the URL hash: #/, #/r/<id>, #/upload, #/login, #/register, #/courses, #/mine */

const $main = document.getElementById('main');
const $account = document.getElementById('account');
const $toast = document.getElementById('toast');

const state = { me: null, meta: null };

// ---------- helpers ----------

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(path, { method = 'GET', body } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

function toast(message) {
  $toast.textContent = message;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), 2600);
}

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' days ago';
  return fmtDate(iso);
}

function typeLabel(id) {
  return state.meta?.types.find((t) => t.id === id)?.label || id;
}

function currentSeason() {
  const m = new Date().getMonth();
  return m < 4 ? 'Spring' : m < 8 ? 'Summer' : 'Fall';
}

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0];
    if (u.hostname.endsWith('youtube.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path, params: new URLSearchParams(query) };
}

function go(path) {
  location.hash = '#' + path;
}

function requireLogin() {
  if (state.me) return true;
  go('/login?next=' + encodeURIComponent(location.hash.slice(1)));
  return false;
}

async function loadMeta() {
  state.meta = await api('/meta');
}

// ---------- account area ----------

document.addEventListener('click', () => document.getElementById('acc-menu')?.classList.remove('open'));

function renderAccount() {
  if (!state.me) {
    $account.innerHTML = `<a href="#/login" class="btn btn-ghost btn-sm">Sign in</a>`;
    return;
  }
  const first = esc(state.me.name.split(' ')[0]);
  $account.innerHTML = `
    <div class="account">
      <button class="btn btn-ghost btn-sm" id="acc-btn" aria-haspopup="true" aria-expanded="false">${first}</button>
      <div class="account-menu" id="acc-menu">
        <div class="who">${esc(state.me.email)}${state.me.isAdmin ? ' (admin)' : ''}</div>
        <a href="#/mine">My uploads</a>
        <button id="logout">Sign out</button>
      </div>
    </div>`;
  const btn = document.getElementById('acc-btn');
  const menu = document.getElementById('acc-menu');
  btn.onclick = (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  };
  document.getElementById('logout').onclick = async () => {
    await api('/auth/logout', { method: 'POST' });
    state.me = null;
    renderAccount();
    toast('Signed out');
    route();
  };
}

function markNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// ---------- shared pieces ----------

function rowHTML(r) {
  const source = r.file ? `${esc(r.file.ext.replace('.', '').toUpperCase())} file` : 'Link';
  return `
    <li class="row">
      <div class="row-code"><span class="hl">${esc(r.courseCode)}</span></div>
      <div>
        <h3 class="row-title"><a href="#/r/${r.id}">${esc(r.title)}</a></h3>
        <p class="row-sub">${esc(r.courseName)} with ${esc(r.facultyName)}</p>
        <div class="facts">
          <span class="tag">${esc(typeLabel(r.type))}</span>
          <span class="initials" title="${esc(r.facultyName)}">${esc(r.facultyInitials)}</span>
          <span class="tag tag-plain">${esc(r.semester)}</span>
          <span class="tag tag-plain">${source}</span>
        </div>
      </div>
      <div class="row-side">
        <div class="row-votes">${r.votes}<span>found it helpful</span></div>
        <div class="muted small">${timeAgo(r.createdAt)}</div>
      </div>
    </li>`;
}

function optionList(items, selected, valueKey, labelFn, emptyLabel) {
  return (
    `<option value="">${emptyLabel}</option>` +
    items
      .map((it) => {
        const v = typeof it === 'string' ? it : it[valueKey];
        const label = typeof it === 'string' ? it : labelFn(it);
        return `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(label)}</option>`;
      })
      .join('')
  );
}

// ---------- view: browse ----------

async function viewBrowse(params) {
  markNav('browse');
  const meta = state.meta;

  // Build the page shell once; later filter changes only refresh the results.
  if ($main.dataset.view !== 'browse') {
    $main.dataset.view = 'browse';
    const popular = [...meta.courses].sort((a, b) => b.count - a.count).slice(0, 8);
    $main.innerHTML = `
      <section class="hero">
        <h1>Study from what your classmates already shared.</h1>
        <p class="muted" style="max-width:60ch">Notes, slides, recorded explanations, books and past questions for BRAC University courses, organised by course, faculty and semester.</p>
        <form class="searchbar" id="search" role="search">
          <input id="q" type="search" aria-label="Search resources" placeholder="Course code, faculty initials or a topic" autocomplete="off">
          <button class="btn btn-primary">Search</button>
        </form>
        ${
          popular.length
            ? `<div class="quick"><span>Popular courses</span>${popular
                .map((c, i) => `<a href="#/?course=${esc(c.code)}" style="--i:${i}" title="${esc(c.name)}"><span class="hl">${esc(c.code)}</span></a>`)
                .join('')}</div>`
            : ''
        }
        <div class="stats">
          <div><strong>${meta.stats.resources}</strong> resources</div>
          <div><strong>${meta.stats.courses}</strong> courses</div>
          <div><strong>${meta.stats.contributors}</strong> ${meta.stats.contributors === 1 ? 'contributor' : 'contributors'}</div>
        </div>
      </section>
      <div class="filters" id="filters"></div>
      <div class="browse">
        <section aria-live="polite">
          <div id="active" class="active-filters"></div>
          <div id="results"><p class="loading">Loading…</p></div>
        </section>
        <aside class="side" id="side"></aside>
      </div>`;

    document.getElementById('search').onsubmit = (e) => {
      e.preventDefault();
      const p = parseHash().params;
      const q = document.getElementById('q').value.trim();
      if (q) p.set('q', q);
      else p.delete('q');
      p.delete('page');
      go('/?' + p.toString());
    };
  }

  document.getElementById('q').value = params.get('q') || '';

  const sel = {
    course: params.get('course') || '',
    faculty: params.get('faculty') || '',
    semester: params.get('semester') || '',
    type: params.get('type') || '',
    sort: params.get('sort') || 'new',
  };

  document.getElementById('filters').innerHTML = `
    <div><label for="f-course">Course</label><select id="f-course" data-k="course">${optionList(meta.courses, sel.course, 'code', (c) => `${c.code} ${c.name}`, 'All courses')}</select></div>
    <div><label for="f-faculty">Faculty</label><select id="f-faculty" data-k="faculty">${optionList(meta.faculties, sel.faculty, 'initials', (f) => `${f.initials} (${f.name})`, 'All faculty')}</select></div>
    <div><label for="f-semester">Semester</label><select id="f-semester" data-k="semester">${optionList(meta.semesters, sel.semester, null, null, 'Any semester')}</select></div>
    <div><label for="f-type">Type</label><select id="f-type" data-k="type">${optionList(meta.types, sel.type, 'id', (t) => t.label, 'All types')}</select></div>
    <div><label for="f-sort">Sort by</label><select id="f-sort" data-k="sort">
      <option value="new" ${sel.sort === 'new' ? 'selected' : ''}>Newest uploads</option>
      <option value="top" ${sel.sort === 'top' ? 'selected' : ''}>Most helpful</option>
      <option value="downloads" ${sel.sort === 'downloads' ? 'selected' : ''}>Most downloaded</option>
      <option value="semester" ${sel.sort === 'semester' ? 'selected' : ''}>Latest semester</option>
    </select></div>`;

  document.querySelectorAll('#filters select').forEach((s) => {
    s.onchange = () => {
      const p = parseHash().params;
      if (s.value) p.set(s.dataset.k, s.value);
      else p.delete(s.dataset.k);
      p.delete('page');
      go('/?' + p.toString());
    };
  });

  // Active filter chips
  const labels = {
    q: (v) => `“${v}”`,
    course: (v) => v,
    faculty: (v) => `Faculty ${v}`,
    semester: (v) => v,
    type: (v) => typeLabel(v),
  };
  const chips = Object.keys(labels)
    .filter((k) => params.get(k))
    .map((k) => `<span class="chip">${esc(labels[k](params.get(k)))}<button data-clear="${k}" aria-label="Remove filter">×</button></span>`);
  const $active = document.getElementById('active');
  $active.innerHTML = chips.length ? chips.join('') + `<button class="linkish" data-clear="all">Clear all</button>` : '';
  $active.querySelectorAll('[data-clear]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.clear === 'all') return go('/');
      const p = parseHash().params;
      p.delete(b.dataset.clear);
      p.delete('page');
      go('/?' + p.toString());
    };
  });

  // Sidebar: course index (or faculty list for the selected course)
  const $side = document.getElementById('side');
  if (sel.course) {
    const course = meta.courses.find((c) => c.code === sel.course);
    $side.innerHTML = `
      <h3>${esc(sel.course)}${course ? ` <span class="muted small">${esc(course.name)}</span>` : ''}</h3>
      <p class="small muted">Want to add something for this course?</p>
      <a class="btn btn-sm" href="#/upload?course=${esc(sel.course)}">Share for ${esc(sel.course)}</a>`;
  } else {
    $side.innerHTML = meta.courses.length
      ? `<h3>Browse by course</h3><ul class="index-list">${meta.courses
          .slice(0, 14)
          .map((c) => `<li><a href="#/?course=${esc(c.code)}"><b>${esc(c.code)}<span class="name">${esc(c.name)}</span></b><span class="count">${c.count}</span></a></li>`)
          .join('')}</ul>${meta.courses.length > 14 ? `<p><a href="#/courses">All ${meta.courses.length} courses</a></p>` : ''}`
      : '';
  }

  // Results
  const query = new URLSearchParams();
  for (const k of ['q', 'course', 'faculty', 'semester', 'type', 'sort', 'page']) if (params.get(k)) query.set(k, params.get(k));
  const $results = document.getElementById('results');
  try {
    const data = await api('/resources?' + query.toString());
    if (!data.items.length) {
      const filtered = chips.length > 0;
      $results.innerHTML = `
        <div class="empty">
          <h3>${filtered ? 'Nothing matches these filters yet' : 'No resources yet'}</h3>
          <p class="muted">${filtered ? 'Try removing a filter, or be the first to share something for this course.' : 'Be the first to share your notes or slides.'}</p>
          <a class="btn btn-primary" href="#/upload${sel.course ? '?course=' + esc(sel.course) : ''}">Share a resource</a>
        </div>`;
      return;
    }
    const page = data.page;
    $results.innerHTML = `
      <div class="results-head"><h2>${data.total} ${data.total === 1 ? 'resource' : 'resources'}</h2></div>
      <ul class="rows">${data.items.map(rowHTML).join('')}</ul>
      ${
        data.pages > 1
          ? `<nav class="pager" aria-label="Pages">
               <button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
               <span class="muted">Page ${page} of ${data.pages}</span>
               <button class="btn btn-sm" data-page="${page + 1}" ${page >= data.pages ? 'disabled' : ''}>Next</button>
             </nav>`
          : ''
      }`;
    $results.querySelectorAll('[data-page]').forEach((b) => {
      b.onclick = () => {
        const p = parseHash().params;
        p.set('page', b.dataset.page);
        go('/?' + p.toString());
        window.scrollTo({ top: document.getElementById('filters').offsetTop - 80 });
      };
    });
  } catch (err) {
    $results.innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
  }
}

// ---------- view: resource detail ----------

async function viewDetail(id) {
  markNav('');
  $main.innerHTML = `<p class="loading">Loading…</p>`;
  let item;
  try {
    ({ item } = await api('/resources/' + encodeURIComponent(id)));
  } catch (err) {
    $main.innerHTML = `<div class="empty" style="margin:40px 0"><h3>${esc(err.message)}</h3><a href="#/">Back to browsing</a></div>`;
    return;
  }

  const yt = item.link ? youtubeId(item.link) : null;
  const related = await api(`/resources?course=${encodeURIComponent(item.courseCode)}&sort=top`).catch(() => ({ items: [] }));
  const others = related.items.filter((r) => r.id !== item.id).slice(0, 5);

  $main.innerHTML = `
    <article class="detail">
      <div>
        <a class="back" href="#/?course=${esc(item.courseCode)}">All ${esc(item.courseCode)} resources</a>
        <h1>${esc(item.title)}</h1>
        <div class="facts" style="margin-top:0">
          <span class="hl">${esc(item.courseCode)}</span>
          <span class="tag">${esc(typeLabel(item.type))}</span>
          <span class="tag tag-plain">${esc(item.semester)}</span>
        </div>

        <div class="actions">
          ${item.file ? `<a class="btn btn-primary" href="/api/resources/${item.id}/file">Download ${esc(item.file.ext.replace('.', '').toUpperCase())} (${fmtSize(item.file.size)})</a>` : ''}
          ${item.file?.previewable ? `<a class="btn" href="/api/resources/${item.id}/file?inline=1" target="_blank" rel="noopener">Open in browser</a>` : ''}
          ${item.link ? `<a class="btn ${item.file ? '' : 'btn-primary'}" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer nofollow">Open link</a>` : ''}
          <button class="btn ${item.voted ? 'is-on' : ''}" id="vote" aria-pressed="${item.voted}"><span>Helpful (<span id="vote-n">${item.votes}</span>)</span></button>
          ${item.canDelete ? `<button class="btn btn-danger" id="del">Delete</button>` : ''}
        </div>

        ${yt ? `<iframe class="embed" src="https://www.youtube-nocookie.com/embed/${esc(yt)}" title="${esc(item.title)}" allowfullscreen loading="lazy"></iframe>` : ''}

        ${item.description ? `<div class="desc">${esc(item.description)}</div>` : `<p class="muted">No description was added.</p>`}

        <section class="comments">
          <h2>Comments <span class="muted small" id="c-count"></span></h2>
          <div id="c-list"><p class="muted">Loading…</p></div>
          ${
            state.me
              ? `<form class="comment-form" id="c-form">
                   <label for="c-text">Add a comment</label>
                   <textarea id="c-text" maxlength="1000" placeholder="Which chapters does this cover? Did it help in the exam?" required></textarea>
                   <button class="btn btn-primary">Post comment</button>
                 </form>`
              : `<p><a href="#/login?next=${encodeURIComponent('/r/' + item.id)}">Sign in</a> to comment.</p>`
          }
        </section>
      </div>

      <aside>
        <dl class="factsheet">
          <div><dt>Course</dt><dd>${esc(item.courseCode)}<span>${esc(item.courseName)}</span></dd></div>
          <div><dt>Faculty</dt><dd>${esc(item.facultyName)}<span>Initials ${esc(item.facultyInitials)}</span></dd></div>
          <div><dt>Semester</dt><dd>${esc(item.semester)}</dd></div>
          <div><dt>Type</dt><dd>${esc(typeLabel(item.type))}</dd></div>
          ${item.file ? `<div><dt>File</dt><dd style="word-break:break-all">${esc(item.file.name)}<span>${fmtSize(item.file.size)}, downloaded ${item.downloads} ${item.downloads === 1 ? 'time' : 'times'}</span></dd></div>` : ''}
          <div><dt>Shared by</dt><dd>${esc(item.uploader.name)}<span>${fmtDate(item.createdAt)}</span></dd></div>
        </dl>
        <p style="margin-top:14px"><a href="#/?faculty=${esc(item.facultyInitials)}">Everything from ${esc(item.facultyInitials)}</a></p>
        ${
          others.length
            ? `<h3 style="margin-top:28px">More for ${esc(item.courseCode)}</h3>
               <ul class="index-list">${others
                 .map((r) => `<li><a href="#/r/${r.id}"><b style="font-family:var(--body)">${esc(r.title)}<span class="name">${esc(typeLabel(r.type))}, ${esc(r.facultyInitials)}, ${esc(r.semester)}</span></b></a></li>`)
                 .join('')}</ul>`
            : ''
        }
      </aside>
    </article>`;

  document.getElementById('vote').onclick = async () => {
    if (!requireLogin()) return;
    try {
      const r = await api(`/resources/${item.id}/vote`, { method: 'POST' });
      document.getElementById('vote-n').textContent = r.votes;
      const b = document.getElementById('vote');
      b.classList.toggle('is-on', r.voted);
      b.setAttribute('aria-pressed', r.voted);
    } catch (err) {
      toast(err.message);
    }
  };

  const del = document.getElementById('del');
  if (del)
    del.onclick = async () => {
      if (!confirm('Delete this resource? The file and its comments will be removed for everyone.')) return;
      try {
        await api('/resources/' + item.id, { method: 'DELETE' });
        await loadMeta();
        toast('Resource deleted');
        go('/');
      } catch (err) {
        toast(err.message);
      }
    };

  loadComments(item.id);
  const form = document.getElementById('c-form');
  if (form)
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = document.getElementById('c-text').value.trim();
      if (!text) return;
      try {
        await api(`/resources/${item.id}/comments`, { method: 'POST', body: { text } });
        document.getElementById('c-text').value = '';
        loadComments(item.id);
      } catch (err) {
        toast(err.message);
      }
    };
}

async function loadComments(id) {
  const $list = document.getElementById('c-list');
  if (!$list) return;
  const { items } = await api(`/resources/${id}/comments`);
  document.getElementById('c-count').textContent = items.length ? `(${items.length})` : '';
  $list.innerHTML = items.length
    ? items
        .map(
          (c) => `
      <div class="comment">
        <div class="comment-meta"><strong style="color:var(--ink)">${esc(c.author)}</strong><span>${timeAgo(c.createdAt)}</span>
          ${c.canDelete ? `<button class="linkish small" data-cdel="${c.id}">Delete</button>` : ''}</div>
        <p>${esc(c.text)}</p>
      </div>`
        )
        .join('')
    : `<p class="muted">No comments yet. Say whether it helped.</p>`;
  $list.querySelectorAll('[data-cdel]').forEach((b) => {
    b.onclick = async () => {
      await api(`/resources/${id}/comments/${b.dataset.cdel}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      loadComments(id);
    };
  });
}

// ---------- view: upload ----------

function viewUpload(params) {
  markNav('upload');
  if (!requireLogin()) return;
  const meta = state.meta;
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear + 2 - 2015 }, (_, i) => thisYear + 1 - i);
  const presetCourse = (params.get('course') || '').toUpperCase();
  const presetName = meta.courses.find((c) => c.code === presetCourse)?.name || '';

  $main.innerHTML = `
    <section class="form-page">
      <h1>Share a resource</h1>
      <p class="muted">Tag it with the course, faculty and semester so juniors in the same section can find it.</p>
      <p class="form-error" id="err" role="alert"></p>
      <form id="up" novalidate>
        <fieldset>
          <legend>Course and faculty</legend>
          <div class="form-grid">
            <div>
              <label for="courseCode">Course code</label>
              <input id="courseCode" name="courseCode" type="text" list="dl-courses" placeholder="CSE110" value="${esc(presetCourse)}" required autocomplete="off">
            </div>
            <div>
              <label for="courseName">Course name</label>
              <input id="courseName" name="courseName" type="text" placeholder="Programming Language I" value="${esc(presetName)}" required>
            </div>
            <div>
              <label for="facultyInitials">Faculty initials</label>
              <input id="facultyInitials" name="facultyInitials" type="text" list="dl-faculty" placeholder="ARF" maxlength="5" required autocomplete="off">
              <span class="hint">The short code shown on your routine.</span>
            </div>
            <div>
              <label for="facultyName">Faculty name</label>
              <input id="facultyName" name="facultyName" type="text" placeholder="Full name" required>
            </div>
            <div>
              <label for="season">Semester</label>
              <select id="season" name="season">${meta.seasons.map((s) => `<option ${s === currentSeason() ? 'selected' : ''}>${s}</option>`).join('')}</select>
            </div>
            <div>
              <label for="year">Year</label>
              <select id="year" name="year">${years.map((y) => `<option ${y === thisYear ? 'selected' : ''}>${y}</option>`).join('')}</select>
            </div>
          </div>
          <datalist id="dl-courses">${meta.courses.map((c) => `<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('')}</datalist>
          <datalist id="dl-faculty">${meta.faculties.map((f) => `<option value="${esc(f.initials)}">${esc(f.name)}</option>`).join('')}</datalist>
        </fieldset>

        <fieldset>
          <legend>What are you sharing?</legend>
          <div class="type-picker">
            ${meta.types.map((t, i) => `<input type="radio" name="type" id="t-${t.id}" value="${t.id}" ${i === 0 ? 'checked' : ''}><label for="t-${t.id}">${esc(t.label)}</label>`).join('')}
          </div>
          <div class="stack" style="margin-top:18px">
            <div>
              <label for="title">Title</label>
              <input id="title" name="title" type="text" maxlength="140" placeholder="Mid-term solutions, Set A" required>
            </div>
            <div>
              <label for="description">Description <span class="hint" style="display:inline">optional</span></label>
              <textarea id="description" name="description" maxlength="3000" placeholder="Which chapters or lectures it covers, and anything a junior should know."></textarea>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>File or link</legend>
          <label class="dropzone" id="drop" for="file">
            <input type="file" id="file" name="file" accept="${meta.allowedExtensions.join(',')}">
            <strong>Choose a file</strong> or drag it here
            <span class="hint">PDF, slides, docs, images, code, zip and more, up to ${meta.maxUploadMB} MB.</span>
          </label>
          <div class="file-picked" id="picked" hidden></div>
          <div class="or">or</div>
          <label for="link">Link to a video, Drive folder or website</label>
          <input id="link" name="link" type="url" placeholder="https://youtube.com/watch?v=…">
          <span class="hint">Big videos work best on YouTube or Google Drive. Paste the link here and it will play on NoteBank.</span>
        </fieldset>

        <button class="btn btn-primary" id="submit">Publish resource</button>
        <div class="progress" id="progress" hidden><span></span></div>
      </form>
    </section>`;

  const $form = document.getElementById('up');
  const $err = document.getElementById('err');
  const $file = document.getElementById('file');
  const $drop = document.getElementById('drop');
  const $picked = document.getElementById('picked');

  // Autofill names from codes that already exist
  const $code = document.getElementById('courseCode');
  $code.addEventListener('change', () => {
    const c = meta.courses.find((x) => x.code === $code.value.trim().toUpperCase().replace(/\s|-/g, ''));
    if (c && !document.getElementById('courseName').value) document.getElementById('courseName').value = c.name;
  });
  const $ini = document.getElementById('facultyInitials');
  $ini.addEventListener('change', () => {
    const f = meta.faculties.find((x) => x.initials === $ini.value.trim().toUpperCase());
    if (f && !document.getElementById('facultyName').value) document.getElementById('facultyName').value = f.name;
  });

  function showPicked() {
    const f = $file.files[0];
    if (!f) {
      $picked.hidden = true;
      return;
    }
    $picked.hidden = false;
    $picked.innerHTML = `<span>${esc(f.name)} <span class="muted">(${fmtSize(f.size)})</span></span><button type="button" class="linkish" id="unpick">Remove</button>`;
    document.getElementById('unpick').onclick = () => {
      $file.value = '';
      showPicked();
    };
    if (f.size > meta.maxUploadMB * 1024 * 1024) $err.textContent = `That file is over ${meta.maxUploadMB} MB. Upload it to Google Drive or YouTube and paste the link instead.`;
    else $err.textContent = '';
  }
  $file.onchange = showPicked;
  ['dragenter', 'dragover'].forEach((ev) =>
    $drop.addEventListener(ev, (e) => {
      e.preventDefault();
      $drop.classList.add('is-over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) => $drop.addEventListener(ev, () => $drop.classList.remove('is-over')));
  $drop.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      $file.files = e.dataTransfer.files;
      showPicked();
    }
  });

  $form.onsubmit = (e) => {
    e.preventDefault();
    $err.textContent = '';
    if (!$file.files[0] && !document.getElementById('link').value.trim()) {
      $err.textContent = 'Attach a file or paste a link.';
      return;
    }
    const fd = new FormData($form);
    if (!$file.files[0]) fd.delete('file');

    const $btn = document.getElementById('submit');
    const $prog = document.getElementById('progress');
    $btn.disabled = true;
    $btn.textContent = 'Publishing…';
    $prog.hidden = !$file.files[0];

    // XHR instead of fetch so we can show upload progress
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/resources');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) $prog.firstElementChild.style.width = Math.round((ev.loaded / ev.total) * 100) + '%';
    };
    xhr.onload = async () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        await loadMeta();
        toast('Published. Thanks for sharing!');
        go('/r/' + data.item.id);
      } else {
        $err.textContent = data.error || 'Upload failed. Try again.';
        $btn.disabled = false;
        $btn.textContent = 'Publish resource';
        $prog.hidden = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    xhr.onerror = () => {
      $err.textContent = 'Network error. Check your connection and try again.';
      $btn.disabled = false;
      $btn.textContent = 'Publish resource';
    };
    xhr.send(fd);
  };
}

// ---------- view: sign in / register ----------

function viewAuth(mode, params) {
  markNav('');
  const next = params.get('next') || '/';
  if (state.me) return go(next);
  const isReg = mode === 'register';
  const domain = state.meta.emailDomain;

  $main.innerHTML = `
    <section class="form-page narrow">
      <h1>${isReg ? 'Create your account' : 'Sign in'}</h1>
      <p class="muted">${isReg ? 'You need an account to share resources, vote and comment. Browsing is open to everyone.' : 'Welcome back.'}</p>
      <p class="form-error" id="err" role="alert"></p>
      <form id="auth" class="stack">
        ${isReg ? `<div><label for="name">Full name</label><input id="name" type="text" autocomplete="name" required></div>` : ''}
        <div>
          <label for="email">${domain ? 'BRACU email' : 'Email'}</label>
          <input id="email" type="email" autocomplete="email" placeholder="${domain ? 'yourname@' + esc(domain) : 'you@example.com'}" required>
        </div>
        ${isReg ? `<div><label for="dept">Department <span class="hint" style="display:inline">optional</span></label><input id="dept" type="text" placeholder="CSE, EEE, BBA…"></div>` : ''}
        <div>
          <label for="password">Password</label>
          <input id="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" minlength="${isReg ? 8 : 1}" required>
          ${isReg ? '<span class="hint">At least 8 characters.</span>' : ''}
        </div>
        <button class="btn btn-primary">${isReg ? 'Create account' : 'Sign in'}</button>
      </form>
      <p style="margin-top:20px">${
        isReg
          ? `Already have an account? <a href="#/login?next=${encodeURIComponent(next)}">Sign in</a>`
          : `New here? <a href="#/register?next=${encodeURIComponent(next)}">Create an account</a>`
      }</p>
    </section>`;

  document.getElementById('auth').onsubmit = async (e) => {
    e.preventDefault();
    const $err = document.getElementById('err');
    $err.textContent = '';
    const body = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
    };
    if (isReg) {
      body.name = document.getElementById('name').value;
      body.department = document.getElementById('dept').value;
    }
    try {
      const { user } = await api('/auth/' + (isReg ? 'register' : 'login'), { method: 'POST', body });
      state.me = user;
      renderAccount();
      toast(isReg ? 'Account created' : 'Signed in');
      go(next);
    } catch (err) {
      $err.textContent = err.message;
    }
  };
}

// ---------- view: courses & faculty directory ----------

function viewCourses() {
  markNav('courses');
  const { courses, faculties } = state.meta;
  const list = (items, href, key, sub) =>
    items.length
      ? `<ul class="index-list">${items
          .map((it) => `<li><a href="${href(it)}"><b>${esc(it[key])}<span class="name">${esc(sub(it))}</span></b><span class="count">${it.count}</span></a></li>`)
          .join('')}</ul>`
      : `<p class="muted">Nothing here yet.</p>`;

  $main.innerHTML = `
    <div class="directory">
      <section>
        <h1 style="font-size:2rem">Courses</h1>
        <input type="search" id="fc" placeholder="Filter courses" style="margin-bottom:10px" aria-label="Filter courses">
        <div id="cl">${list(courses, (c) => `#/?course=${encodeURIComponent(c.code)}`, 'code', (c) => c.name)}</div>
      </section>
      <section>
        <h1 style="font-size:2rem">Faculty</h1>
        <input type="search" id="ff" placeholder="Filter by name or initials" style="margin-bottom:10px" aria-label="Filter faculty">
        <div id="fl">${list(faculties, (f) => `#/?faculty=${encodeURIComponent(f.initials)}`, 'initials', (f) => f.name)}</div>
      </section>
    </div>`;

  const bindFilter = (inputId, listId) => {
    document.getElementById(inputId).oninput = (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll(`#${listId} li`).forEach((li) => {
        li.hidden = !li.textContent.toLowerCase().includes(q);
      });
    };
  };
  bindFilter('fc', 'cl');
  bindFilter('ff', 'fl');
}

// ---------- view: my uploads ----------

async function viewMine() {
  markNav('');
  if (!requireLogin()) return;
  $main.innerHTML = `<section style="padding:36px 0 56px"><h1 style="font-size:2rem">My uploads</h1><div id="mine"><p class="loading">Loading…</p></div></section>`;
  const data = await api('/resources?mine=1&sort=new');
  document.getElementById('mine').innerHTML = data.items.length
    ? `<p class="muted">${data.total} shared. Open one to delete it.</p><ul class="rows">${data.items.map(rowHTML).join('')}</ul>`
    : `<div class="empty"><h3>You haven't shared anything yet</h3><p class="muted">Your notes could save someone's mid-term.</p><a class="btn btn-primary" href="#/upload">Share a resource</a></div>`;
}

// ---------- router ----------

async function route() {
  const { path, params } = parseHash();
  if (path !== '/') delete $main.dataset.view;
  try {
    if (path === '/') return await viewBrowse(params);
    if (path.startsWith('/r/')) return await viewDetail(path.slice(3));
    if (path === '/upload') return viewUpload(params);
    if (path === '/login') return viewAuth('login', params);
    if (path === '/register') return viewAuth('register', params);
    if (path === '/courses') return viewCourses();
    if (path === '/mine') return await viewMine();
    $main.innerHTML = `<div class="empty" style="margin:40px 0"><h3>Page not found</h3><a href="#/">Go to browsing</a></div>`;
  } catch (err) {
    $main.innerHTML = `<p class="form-error" style="margin-top:40px">${esc(err.message)}</p>`;
  }
}

let lastPath = null;
window.addEventListener('hashchange', () => {
  const { path } = parseHash();
  if (path !== lastPath) {
    window.scrollTo(0, 0);
    $main.focus({ preventScroll: true });
  }
  lastPath = path;
  route();
});

(async function init() {
  try {
    const [{ user }] = await Promise.all([api('/auth/me'), loadMeta()]);
    state.me = user;
  } catch (err) {
    $main.innerHTML = `<p class="form-error" style="margin-top:40px">Can't reach the server: ${esc(err.message)}</p>`;
    return;
  }
  renderAccount();
  lastPath = parseHash().path;
  route();
})();
