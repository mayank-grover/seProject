import { campusNow, weekday, status, time, pretty, overlaps } from './engine.mjs';
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  building: '<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-5h6v5M8 8h1m6 0h1M8 12h1m6 0h1"/>',
  flask: '<path d="M9 3h6M10 3v7l-6 9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l-6-9V3M7 15h10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  room: '<path d="M4 21V5l12-2v18M2 21h20M16 7h4v14M12 12h.01"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.room}</svg>`;
}
function icons() {
  for (const el of $$('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
}
icons();
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
function persist(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    toast('Browser storage is unavailable; changes last for this visit.');
  }
}
let toastTimer;
let data, loadError;
try {
  const r = await fetch('/data.json');
  if (!r.ok) throw Error(r.status);
  data = await r.json();
} catch (e) {
  loadError = e;
  data = { rooms: [], events: [], sources: [], unresolved: [], cellCount: 0 };
  toast('The timetable could not be loaded. Reload to try again.');
}
const saved = new Set(read('stillspace:saved', []));
let notes = read('stillspace:notes', {});
let state = {
  ...campusNow(),
  testing: false,
  duration: 60,
  filter: 'all',
  view: 'explore',
  query: '',
  type: 'all',
  sort: 'availability',
  limit: 6,
  list: false,
  weekRoom: 'L21',
  weekBranch: 'all',
};
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}
const dateLabel = (date) =>
  new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
const shortDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function roomStatus(r) {
  return status(r, data.events, state.date, state.minutes, state.duration);
}
function updateClock() {
  $('#clock-time').textContent = pretty(state.minutes).replace(/\s?(AM|PM)/, '');
  $('#clock-period').textContent = pretty(state.minutes).match(/AM|PM/)[0];
  $('#date-display').textContent = dateLabel(state.date);
  const angle = (state.minutes / 1440) * Math.PI * 2,
    x = 120 + 94 * Math.sin(angle),
    y = 120 - 94 * Math.cos(angle);
  for (const id of ['dial-knob', 'dial-knob-dot']) {
    $('#' + id).setAttribute('cx', x);
    $('#' + id).setAttribute('cy', y);
  }
  $('#dial-hand').setAttribute('x2', 120 + 59 * Math.sin(angle));
  $('#dial-hand').setAttribute('y2', 120 - 59 * Math.cos(angle));
  $('#dial-progress').style.strokeDasharray = `${(state.minutes / 1440) * 100} 100`;
  const dial = $('#time-dial');
  dial.setAttribute('aria-valuenow', state.minutes);
  dial.setAttribute('aria-valuetext', pretty(state.minutes));
  dial.setAttribute('aria-disabled', !state.testing);
  dial.tabIndex = state.testing ? 0 : -1;
  $('#sim-date').value = state.date;
  $('#sim-time').value = time(state.minutes);
  $('#clock-badge').textContent = state.testing ? 'Simulated' : 'Now';
  $('#clock-eyebrow').textContent = state.testing ? 'TIME TRAVEL, GENTLY' : 'CAMPUS CLOCK';
  $('#clock-heading').textContent = state.testing
    ? 'A different point in time.'
    : 'Make time for focus.';
  $('#clock-description').textContent = state.testing
    ? 'Change the clock. Watch campus change.'
    : 'Your campus day, at a glance.';
  $('#date-display').hidden = state.testing;
  $('#testing-date').hidden = !state.testing;
  $('#sim-controls').hidden = !state.testing;
  $('#live-clock-footer').hidden = state.testing;
  $('#test-toggle').setAttribute('aria-pressed', state.testing);
  document.body.classList.toggle('testing', state.testing);
}
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2,
    major = i % 4 === 0,
    r1 = major ? 82 : 85,
    r2 = 88;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', 120 + r1 * Math.sin(a));
  line.setAttribute('y1', 120 - r1 * Math.cos(a));
  line.setAttribute('x2', 120 + r2 * Math.sin(a));
  line.setAttribute('y2', 120 - r2 * Math.cos(a));
  line.setAttribute('class', `dial-tick ${major ? 'major' : ''}`);
  $('#dial-ticks').append(line);
}
function timeline(r, events = roomStatus(r).events) {
  const segments = Array.from({ length: 20 }, (_, i) => {
    const start = 480 + i * 30;
    return `<span class="${events.some((e) => overlaps(start, start + 30, e.start, e.end)) ? 'busy' : ''}" title="${time(start)}–${time(start + 30)}"></span>`;
  }).join('');
  const marker =
    state.minutes >= 480 && state.minutes <= 1080
      ? `<i class="now-marker" style="left:${((state.minutes - 480) / 600) * 100}%"></i>`
      : '';
  return `<div class="timeline" aria-label="Teaching schedule 08:00 to 18:00; see room details for events">${segments}${marker}</div><div class="timeline-labels"><span>08:00</span><span>12:00</span><span>18:00</span></div>`;
}
function card(r) {
  const s = roomStatus(r);
  const until =
    s.kind === 'free'
      ? `Gap until ${pretty(s.until)}`
      : s.kind === 'busy'
        ? `${s.hits.length} overlapping ${s.hits.length === 1 ? 'entry' : 'entries'}`
        : 'Check access locally';
  return `<article class="room-card"><div class="room-card-top"><div class="room-visual ${r.type}">${icon(r.type === 'lab' ? 'flask' : 'room')}</div><button class="save-button ${saved.has(r.id) ? 'saved' : ''}" data-save="${r.id}" aria-label="${saved.has(r.id) ? 'Unsave' : 'Save'} ${esc(r.name)}" aria-pressed="${saved.has(r.id)}">${icon('heart')}</button></div><h3 class="room-title">${esc(r.name)}</h3><p class="room-location">${icon('pin')}${esc(r.location)}</p><div class="room-status ${s.kind}"><span class="status-dot"></span>${esc(s.label)}</div><div class="room-meta"><span>${r.type === 'lab' ? 'Laboratory' : 'Classroom'}</span><span>Access unverified</span></div>${timeline(r, s.events)}<div class="room-bottom"><span>${esc(until)}</span><button data-room="${r.id}">Take a look <span>↗</span></button></div></article>`;
}
function results() {
  let rs = data.rooms.filter(
    (r) =>
      (state.view !== 'saved' || saved.has(r.id)) &&
      (state.type === 'all' || r.type === state.type) &&
      `${r.name} ${r.id} ${r.location}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  if (state.filter !== 'all') rs = rs.filter((r) => roomStatus(r).kind === state.filter);
  const rank = { free: 0, unknown: 1, busy: 2 };
  rs.sort(
    (a, b) =>
      (state.sort === 'availability' ? rank[roomStatus(a).kind] - rank[roomStatus(b).kind] : 0) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  return rs;
}
function render() {
  updateClock();
  $('#saved-count').textContent = saved.size;
  const view = state.view;
  $$('.nav-button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#page-crumb').textContent = {
    explore: 'Find a space',
    timetable: 'Timetables',
    saved: 'Saved spaces',
    sources: 'Data & sources',
  }[view];
  $('#section-title').textContent = {
    explore: 'Your next study spot',
    saved: 'Your familiar corners',
    timetable: 'The campus week',
    sources: 'A clear view of the data',
  }[view];
  const roomView = view === 'explore' || view === 'saved';
  $('#results').hidden = !roomView;
  $('#other-view').hidden = roomView;
  $('.filter-row').hidden = !roomView;
  $('.view-switch').hidden = !roomView;
  $('#show-more').hidden = true;
  $('.search-panel').hidden = !roomView;
  $('#hero-title').innerHTML = {
    explore: 'Find your<br><em>focus space.</em>',
    saved: 'Good spaces.<br><em>Worth keeping.</em>',
    timetable: 'Every class.<br><em>A little clearer.</em>',
    sources: 'Good decisions.<br><em>Clear sources.</em>',
  }[view];
  $('#hero-description').innerHTML = {
    explore:
      'A free period. A fresh perspective.<br>Find your corner of campus, at just the right time.',
    saved: 'Keep your favourite corners close.<br>Your saved spaces stay on this browser.',
    timetable:
      'The CSE week, one room or branch at a time.<br>See the schedule behind every suggestion.',
    sources:
      'A useful starting point, with the context intact.<br>Explore what we know, and what needs a second look.',
  }[view];
  if (roomView) {
    const rs = results(),
      gaps = data.rooms.filter((r) => roomStatus(r).kind === 'free').length;
    $('#all-count').textContent = data.rooms.length;
    $('#results-summary').textContent = loadError
      ? 'Schedule unavailable · reload to try again'
      : `${rs.length} spaces · ${shortDay[weekday(state.date)]}, ${pretty(state.minutes)} · ${state.duration} min${state.testing ? ' · simulation' : ''}`;
    $('#results').classList.toggle('list-mode', state.list);
    $('#cards-view').classList.toggle('selected', !state.list);
    $('#list-view').classList.toggle('selected', state.list);
    $('#results').innerHTML = rs.length
      ? rs.slice(0, state.limit).map(card).join('')
      : `<div class="empty-state"><span>✳</span><h3>${view === 'saved' && !saved.size ? 'Your next favourite is out there.' : state.filter === 'free' ? 'No schedule gaps for this moment.' : 'No spaces match just yet.'}</h3><p>${view === 'saved' && !saved.size ? 'Tap the heart on a room to keep it here.' : state.filter === 'free' ? 'Try a shorter stay or another weekday. Weekends and dates outside the source period remain unverified.' : 'Try another room name, clear the space type, or reset your filters.'}</p><button class="primary-button" data-reset-filters>${view === 'saved' && !saved.size ? 'Explore spaces' : 'Reset filters'} <span>↗</span></button></div>`;
    $('#show-more').hidden = rs.length <= state.limit;
    $('#show-more').innerHTML =
      `Explore ${Math.min(6, rs.length - state.limit)} more spaces <span>↓</span>`;
    $$('[data-filter]').forEach((b) =>
      b.classList.toggle('active', b.dataset.filter === state.filter),
    );
  } else if (view === 'timetable') {
    renderWeek();
  } else renderSources();
}
function setSim(date, minutes) {
  if (date) state.date = date;
  if (minutes !== undefined)
    state.minutes = Math.max(0, Math.min(1435, Math.round(minutes / 5) * 5));
  state.testing = true;
  render();
}
function realTime() {
  state.testing = false;
  Object.assign(state, campusNow());
  render();
}
$('#test-toggle').onclick = () => {
  if (state.testing) realTime();
  else {
    state.testing = true;
    render();
  }
};
$('#sim-date').onchange = (e) => {
  if (!e.target.value) {
    e.target.value = state.date;
    return;
  }
  setSim(e.target.value);
};
$('#sim-time').onchange = (e) => {
  const v = e.target.value;
  if (v) {
    const [h, m] = v.split(':').map(Number);
    setSim(null, h * 60 + m);
  }
};
$('#minus-time').onclick = () => setSim(null, state.minutes - 15);
$('#plus-time').onclick = () => setSim(null, state.minutes + 15);
$('#reset-time').onclick = realTime;
$$('[data-preset]').forEach(
  (b) =>
    (b.onclick = () => {
      const p = {
        morning: ['2026-10-19', 630],
        lunch: ['2026-10-19', 780],
        boundary: ['2026-10-19', 660],
        weekend: ['2026-10-18', 630],
      }[b.dataset.preset];
      setSim(...p);
    }),
);
const dial = $('#time-dial');
let dragging = false;
function drag(e) {
  if (!state.testing) return;
  const b = dial.getBoundingClientRect(),
    x = e.clientX - b.left - b.width / 2,
    y = e.clientY - b.top - b.height / 2;
  const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
  setSim(null, (Math.round(((angle / (Math.PI * 2)) * 1440) / 5) * 5) % 1440);
}
dial.addEventListener('pointerdown', (e) => {
  if (!state.testing) return;
  dragging = true;
  dial.setPointerCapture(e.pointerId);
  drag(e);
});
dial.addEventListener('pointermove', (e) => {
  if (dragging) drag(e);
});
dial.addEventListener('pointerup', () => (dragging = false));
dial.addEventListener('pointercancel', () => (dragging = false));
dial.addEventListener('keydown', (e) => {
  if (!state.testing) return;
  const k = e.key;
  if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(k)) {
    e.preventDefault();
    setSim(
      null,
      k === 'Home'
        ? 0
        : k === 'End'
          ? 1435
          : state.minutes +
            (['ArrowRight', 'ArrowUp'].includes(k) ? 1 : -1) * (e.shiftKey ? 60 : 5),
    );
  }
});
$$('[data-view]').forEach(
  (b) =>
    (b.onclick = () => {
      state.view = b.dataset.view;
      state.limit = 6;
      render();
    }),
);
$('#search').oninput = (e) => {
  state.query = e.target.value;
  state.limit = 6;
  render();
};
$('#type').onchange = (e) => {
  state.type = e.target.value;
  state.limit = 6;
  render();
};
$('#duration').onchange = (e) => {
  state.duration = Number(e.target.value);
  render();
};
$('#sort').onchange = (e) => {
  state.sort = e.target.value;
  render();
};
$('#find').onclick = () => {
  state.view = 'explore';
  state.limit = 6;
  render();
  $('#section-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
};
$$('[data-filter]').forEach(
  (b) =>
    (b.onclick = () => {
      state.filter = b.dataset.filter;
      state.limit = 6;
      render();
    }),
);
$('#cards-view').onclick = () => {
  state.list = false;
  render();
};
$('#list-view').onclick = () => {
  state.list = true;
  render();
};
$('#show-more').onclick = () => {
  state.limit += 6;
  render();
};
$('#source-link').onclick = () => {
  state.view = 'sources';
  render();
};
function openRoom(id) {
  const r = data.rooms.find((r) => r.id === id);
  if (!r) return;
  const s = roomStatus(r),
    events = s.events;
  const note = notes[id];
  $('#room-detail').innerHTML =
    `<div class="modal-body"><div class="modal-head"><div><div class="eyebrow">A CLOSER LOOK</div><h2>${esc(r.name)}</h2><div class="modal-subtitle">${esc(r.location)} · ${r.type === 'lab' ? 'Laboratory' : 'Classroom'}</div></div><button class="close-button" data-close aria-label="Close room details">×</button></div><div class="detail-notice ${s.kind}"><strong>${esc(s.label)}</strong> · ${dateLabel(state.date)}, ${pretty(state.minutes)}–${pretty(state.minutes + state.duration)}.<br>${s.kind === 'free' ? 'No mapped CSE class overlaps your full interval. Actual occupancy and access are unknown.' : s.kind === 'busy' ? 'At least one imported class overlaps your requested interval.' : 'No reliable availability claim can be made for this date and interval.'}</div><div class="meta-grid"><div><small>CAPACITY</small><span>Not supplied</span></div><div><small>STUDY PERMISSION</small><span>Unverified · check with staff</span></div><div><small>FLOOR & AMENITIES</small><span>Not supplied</span></div><div><small>EVIDENCE</small><span>Partial CSE timetable · OCR</span></div></div><h3 class="detail-heading">${shortDay[weekday(state.date)]}’s imported schedule</h3>${events.length ? events.map((e) => `<div class="schedule-event"><time>${time(e.start)}–${time(e.end)}</time><div><strong>${esc(e.branch)}</strong><p>${esc(e.text)}</p><button class="source-button" data-source="${e.page}">View scanned source · page ${e.page} ↗</button></div></div>`).join('') : '<p class="source-explainer">No mapped entries for this day. This does not establish room availability; unmapped electives and other departments may still use the room.</p>'}<h3 class="detail-heading">Your private room note</h3><p class="source-explainer">For your own reference on this browser. These notes are not shared reports and do not change schedule status.</p><div class="local-notes"><button data-note="occupied" data-note-room="${id}">Occupied</button><button data-note="locked" data-note-room="${id}">Locked</button><button data-note="empty" data-note-room="${id}">Looks empty</button><button data-note="clear" data-note-room="${id}">Clear note</button></div><div class="local-note" id="local-note">${note ? `You noted “${esc(note.status)}” on ${new Date(note.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. A past note is not current evidence.` : 'No private note yet.'}</div><button class="show-more" data-week-room="${id}">See the full room week <span>↗</span></button></div>`;
  if (!$('#room-dialog').open) $('#room-dialog').showModal();
}
function openSource(page) {
  const source = data.sources.find((s) => s.page === Number(page));
  if (!source) return;
  $('#source-detail').innerHTML =
    `<div class="modal-body"><div class="modal-head"><div><div class="eyebrow">ORIGINAL SCANNED PAGE ${source.page}</div><h2 style="font-size:23px">${esc(source.title)}</h2></div><button class="close-button" data-close aria-label="Close scanned source">×</button></div><p class="source-explainer">Effective 09 October 2026. OCR entries are provisional. Use this original page to verify room numbers, merged cells and timings.</p><a href="${source.image}" target="_blank" rel="noopener"><img class="source-photo" src="${source.image}" alt="Original ${esc(source.title)} timetable, page ${source.page}"></a><p class="source-explainer">Tap the scan to open it at full size.</p></div>`;
  if (!$('#source-dialog').open) $('#source-dialog').showModal();
}
function renderSources() {
  const e = data.events.length;
  $('#results-summary').textContent = 'Source transparency · no invented occupancy predictions';
  $('#other-view').innerHTML =
    `<div class="source-stats"><div><strong>${data.sources.length}</strong><small>TIMETABLE PAGES</small></div><div><strong>${e}</strong><small>MAPPED ENTRIES</small></div><div><strong>${data.rooms.length}</strong><small>ROOM REFERENCES</small></div></div><div class="coverage-warning"><strong>Partial coverage, honest uncertainty.</strong><br>${data.cellCount} nonempty cells extracted; ${data.unresolved.length} have no mapped room. Shared electives, other departments, closures, holidays and the academic calendar are incomplete. All OCR entries need review. The 09 Oct–31 Dec 2026 review window and 08:00–18:00 search window are prototype settings, not confirmed opening hours.</div><h3 class="source-section-heading">The source, page by page.</h3>${data.sources.map((s) => `<div class="source-row"><div>${esc(s.title)}<br><span>Page ${s.page} · ${data.events.filter((e) => e.page === s.page).length} mapped entries</span></div><button data-source="${s.page}">View scan ↗</button></div>`).join('')}<div class="source-actions"><button id="export-json">↓ Export normalized JSON</button><button id="export-csv">↓ Export events CSV</button></div><h3 class="source-section-heading">Still to verify</h3><p class="source-explainer">Room inventory, capacity, floor, amenities, quietness, approved study access, semester end and exceptions. No live sensors, shared reports or trained occupancy model are connected.</p><details><summary class="source-explainer">Review ${data.unresolved.length} unmapped cells</summary>${data.unresolved.map((c) => `<div class="schedule-event"><time>p.${c.page} · ${shortDay[c.day].slice(0, 3)}<br>${time(c.start)}–${time(c.end)}</time><div><strong>${esc(c.branch)}</strong><p>${esc(c.text)}</p><button class="source-button" data-source="${c.page}">Review scan ↗</button></div></div>`).join('')}</details>`;
  $('#export-json').onclick = () =>
    download('stillspace-timetable.json', JSON.stringify(data, null, 2), 'application/json');
  $('#export-csv').onclick = () => {
    const rows = [
      ['id', 'room_ids', 'weekday', 'start', 'end', 'branch', 'source_page', 'ocr_text'],
      ...data.events.map((e) => [
        e.id,
        e.rooms.join(';'),
        e.day,
        time(e.start),
        time(e.end),
        e.branch,
        e.page,
        e.text,
      ]),
    ];
    download(
      'stillspace-events.csv',
      rows
        .map((r) => r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(','))
        .join('\r\n'),
      'text/csv',
    );
  };
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your export is ready.');
}
function renderWeek() {
  $('#results-summary').textContent = 'Weekly recurrence · all room conflicts use every branch';
  const room = data.rooms.find((r) => r.id === state.weekRoom) || data.rooms[0];
  if (!room) {
    $('#other-view').innerHTML = '<p class="source-explainer">No timetable loaded.</p>';
    return;
  }
  const branches = data.sources.map((s) => s.title),
    branch = state.weekBranch;
  $('#other-view').innerHTML =
    `<div class="week-controls"><select id="week-room" aria-label="Room timetable">${data.rooms.map((r) => `<option value="${r.id}" ${r.id === room.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><select id="week-branch" aria-label="Filter displayed branch"><option value="all">All branches</option>${branches.map((b) => `<option ${branch === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div><div class="weekly-scroll"><table class="week-table"><thead><tr><th>IST</th>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => `<th>${d}</th>`).join('')}</tr></thead><tbody>${Array.from(
      { length: 10 },
      (_, i) => {
        const start = 480 + i * 60;
        return `<tr><th>${time(start)}</th>${[1, 2, 3, 4, 5]
          .map((day) => {
            const events = data.events.filter(
              (e) =>
                e.rooms.includes(room.id) &&
                e.day === day &&
                overlaps(start, start + 60, e.start, e.end) &&
                (branch === 'all' || e.branch === branch),
            );
            return `<td class="${events.length ? 'class-cell' : ''} ${day === weekday(state.date) && state.minutes >= start && state.minutes < start + 60 ? 'highlight' : ''}">${events.length ? events.map((e) => `<div>${esc(e.text).slice(0, 130)}${e.text.length > 130 ? '…' : ''}<br><button data-source="${e.page}">Source p.${e.page} ↗</button></div>`).join('<hr>') : '—'}</td>`;
          })
          .join('')}</tr>`;
      },
    ).join(
      '',
    )}</tbody></table></div><p class="source-explainer">A dash means no mapped entry, not confirmed availability. Branch selection only filters this table; room search always checks every mapped branch. Dates and exceptions are not included in this recurring overview.</p>`;
  $('#week-room').onchange = (e) => {
    state.weekRoom = e.target.value;
    renderWeek();
  };
  $('#week-branch').onchange = (e) => {
    state.weekBranch = e.target.value;
    renderWeek();
  };
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.save) {
    const id = b.dataset.save;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    persist('stillspace:saved', [...saved]);
    render();
  }
  if (b.dataset.room) openRoom(b.dataset.room);
  if (b.dataset.source) openSource(b.dataset.source);
  if (b.hasAttribute('data-close')) b.closest('dialog').close();
  if (b.hasAttribute('data-reset-filters')) {
    state.query = '';
    state.type = 'all';
    state.filter = 'all';
    state.view = 'explore';
    $('#search').value = '';
    $('#type').value = 'all';
    render();
  }
  if (b.dataset.weekRoom) {
    state.weekRoom = b.dataset.weekRoom;
    state.view = 'timetable';
    $('#room-dialog').close();
    render();
  }
  if (b.dataset.note) {
    const id = b.dataset.noteRoom;
    if (b.dataset.note === 'clear') delete notes[id];
    else notes[id] = { status: b.dataset.note, at: new Date().toISOString() };
    persist('stillspace:notes', notes);
    openRoom(id);
    toast('Private note updated on this browser.');
  }
});
for (const d of $$('dialog'))
  d.addEventListener('click', (e) => {
    if (e.target === d) {
      const b = d.getBoundingClientRect();
      if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
        d.close();
    }
  });
setInterval(() => {
  if (!state.testing) {
    const now = campusNow();
    if (now.date !== state.date || now.minutes !== state.minutes) {
      Object.assign(state, now);
      render();
    }
  }
}, 1000);
render();
