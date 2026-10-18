import { campusNow, weekday, status, time, pretty, overlaps } from './engine.mjs';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const paths = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  flask: '<path d="M9 3h6M10 3v7l-6 9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2l-6-9V3M7 15h10"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  room: '<path d="M4 21V5l12-2v18M2 21h20M16 7h4v14M12 12h.01"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.9 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
  device: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.room}</svg>`;
}
function hydrateIcons() {
  for (const element of $$('[data-icon]')) element.innerHTML = icon(element.dataset.icon);
}
hydrateIcons();
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    toast('Storage unavailable. Changes last for this visit.');
  }
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2800);
}
let preference = read('stillspace:theme', 'system');
let reducedGlass = read('stillspace:solid', false);
let systemDark =
  window.StillspaceAndroid?.isDark?.() ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
function applyTheme() {
  const dark = preference === 'dark' || (preference === 'system' && systemDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('solid-glass', reducedGlass);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#161c18' : '#f4f5f0';
  $('#appearance').innerHTML = icon(dark ? 'moon' : 'sun');
  window.StillspaceAndroid?.setAppearance?.(dark);
  $$('.appearance-options [data-theme]').forEach((button) => {
    const selected = button.dataset.theme === preference;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected);
  });
  $('#reduce-transparency').checked = reducedGlass;
}
window.stillspaceSystemTheme = (dark) => {
  systemDark = dark;
  applyTheme();
};
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  systemDark = event.matches;
  applyTheme();
});
applyTheme();
const saved = new Set(read('stillspace:saved', []));
let notes = read('stillspace:notes', {});
let data = { rooms: [], events: [], sources: [], unresolved: [], cellCount: 0 };
let loadError = false;
const state = {
  ...campusNow(),
  testing: false,
  view: 'explore',
  query: '',
  type: 'all',
  filter: 'all',
  duration: 60,
  limit: 6,
  weekRoom: 'L21',
  weekBranch: 'all',
  weekDay: 1,
};
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function dateLabel(date) {
  return new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}
function roomStatus(room) {
  return status(room, data.events, state.date, state.minutes, state.duration);
}
function updateClock() {
  $('#clock-time').textContent = pretty(state.minutes).replace(/\s?(AM|PM)/, '');
  $('#clock-period').textContent = pretty(state.minutes).match(/AM|PM/)[0] + ' · IST';
  const angle = (state.minutes / 1440) * Math.PI * 2;
  for (const id of ['dial-knob', 'dial-knob-dot']) {
    $('#' + id).setAttribute('cx', 140 + 118 * Math.sin(angle));
    $('#' + id).setAttribute('cy', 140 - 118 * Math.cos(angle));
  }
  $('#dial-progress').style.strokeDasharray = `${(state.minutes / 1440) * 100} 100`;
  $('#time-dial').setAttribute('aria-valuenow', state.minutes);
  $('#time-dial').setAttribute('aria-valuetext', pretty(state.minutes));
  $('#sim-date').value = state.date;
  $('#sim-time').value = time(state.minutes);
  $('#time-context-label').textContent = state.testing
    ? `${dateLabel(state.date)} · ${pretty(state.minutes)}`
    : `Now · ${pretty(state.minutes)}`;
  $('#test-toggle').setAttribute(
    'aria-label',
    `${state.testing ? 'Simulated' : 'Current'} time ${dateLabel(state.date)}, ${pretty(state.minutes)}. Open time tester.`,
  );
  document.body.classList.toggle('simulation-active', state.testing);
}
for (let i = 0; i < 48; i++) {
  const angle = (i / 48) * Math.PI * 2,
    r = i % 4 === 0 ? 101 : 106;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  for (const [attr, value] of Object.entries({
    x1: 140 + r * Math.sin(angle),
    y1: 140 - r * Math.cos(angle),
    x2: 140 + 111 * Math.sin(angle),
    y2: 140 - 111 * Math.cos(angle),
    class: `dial-tick ${i % 4 === 0 ? 'major' : ''}`,
  }))
    line.setAttribute(attr, value);
  $('#dial-ticks').append(line);
}
function timeline(room, events) {
  const segments = Array.from({ length: 20 }, (_, i) => {
    const start = 480 + i * 30;
    return `<span class="${events.some((event) => overlaps(start, start + 30, event.start, event.end)) ? 'busy' : ''}"></span>`;
  }).join('');
  const marker =
    state.minutes >= 480 && state.minutes <= 1080
      ? `<i class="now-marker" style="left:${((state.minutes - 480) / 600) * 100}%"></i>`
      : '';
  return `<div class="timeline" aria-label="Mapped schedule from 08:00 to 18:00. See room details for event times.">${segments}${marker}</div><div class="timeline-labels"><span>08:00</span><span>13:00</span><span>18:00</span></div>`;
}
function card(room) {
  const s = roomStatus(room);
  const detail =
    s.kind === 'free'
      ? `Gap until ${pretty(s.until)}`
      : s.kind === 'busy'
        ? `${s.hits.length} overlapping ${s.hits.length === 1 ? 'entry' : 'entries'}`
        : 'Access unverified';
  return `<article class="room-card"><div class="room-card-top"><div><div class="room-kind">${icon(room.type === 'lab' ? 'flask' : 'room')}${room.type === 'lab' ? 'Laboratory' : 'Classroom'} · ${room.id === 'EE-CLASS' ? 'EE department' : 'CSE schedule'}</div><h3 class="room-title">${esc(room.name)}</h3></div><button class="save-button icon-button ${saved.has(room.id) ? 'saved' : ''}" data-save="${room.id}" aria-label="${saved.has(room.id) ? 'Unsave' : 'Save'} ${esc(room.name)}" aria-pressed="${saved.has(room.id)}">${icon('heart')}</button></div><div class="room-status ${s.kind}"><span class="status-dot"></span>${esc(s.label)}</div>${timeline(room, s.events)}<div class="room-bottom"><span>${esc(detail)}</span><button data-room="${room.id}" aria-label="Details for ${esc(room.name)}">Details ${icon('arrow')}</button></div></article>`;
}
function results() {
  const rank = { free: 0, unknown: 1, busy: 2 };
  return data.rooms
    .filter(
      (room) =>
        (state.view !== 'saved' || saved.has(room.id)) &&
        (state.type === 'all' || room.type === state.type) &&
        `${room.name} ${room.id} ${room.location}`
          .toLowerCase()
          .includes(state.query.toLowerCase()) &&
        (state.filter === 'all' || roomStatus(room).kind === state.filter),
    )
    .sort(
      (a, b) =>
        rank[roomStatus(a).kind] - rank[roomStatus(b).kind] ||
        a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
}
function empty(title, description, action = 'Reset filters') {
  return `<div class="empty-state"><div class="empty-symbol">${icon('compass')}</div><h3>${title}</h3><p>${description}</p><button data-reset-filters class="secondary-button full">${action} ${icon('arrow')}</button></div>`;
}
function render() {
  updateClock();
  const index = ['explore', 'timetable', 'saved', 'sources'].indexOf(state.view);
  $('.nav-indicator').style.transform = `translateX(${index * 100}%)`;
  $$('.nav-button').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('#saved-count').textContent = saved.size || '';
  const roomView = ['explore', 'saved'].includes(state.view);
  $('.section-heading').classList.toggle('sr-only', roomView);
  $('#results').hidden = !roomView;
  $('#other-view').hidden = roomView;
  $('#explore-controls').hidden = !roomView;
  $('#show-more').hidden = true;
  $('.time-context').hidden = state.view === 'sources';
  $('#hero-title').innerHTML = {
    explore: 'Room to <em>think.</em>',
    timetable: 'Your week.<br><em>A little clearer.</em>',
    saved: 'Familiar <em>corners.</em>',
    sources: 'Good data.<br><em>Clear context.</em>',
  }[state.view];
  $('#hero-description').textContent = {
    explore: 'Find a gap in the day. Make it yours.',
    timetable: 'One room, every class. All in one place.',
    saved: 'Keep the spaces you come back to.',
    sources: 'The source behind every schedule gap.',
  }[state.view];
  $('#section-title').textContent = {
    explore: 'Explore campus',
    timetable: 'Weekly schedule',
    saved: 'Saved spaces',
    sources: 'Timetable coverage',
  }[state.view];
  if (roomView) {
    const rooms = results();
    $('#all-count').textContent = data.rooms.length;
    $('#results-summary').textContent = loadError
      ? 'Could not load data'
      : `${rooms.length} spaces · ${state.duration} min`;
    $('#results').innerHTML = rooms.length
      ? rooms.slice(0, state.limit).map(card).join('')
      : loadError
        ? empty(
            'A small interruption.',
            'The bundled timetable could not be loaded. Reopen the app to try again.',
            'Try again',
          )
        : state.view === 'saved' && !saved.size
          ? empty(
              'Keep a good corner.',
              'Tap the heart on any space to save it on this device.',
              'Explore spaces',
            )
          : empty(
              state.filter === 'free' ? 'No gaps for this moment.' : 'Nothing here just yet.',
              state.filter === 'free'
                ? 'Try a shorter stay or another weekday. Weekends and dates outside the source period stay unverified.'
                : 'Try another name or clear your filters.',
            );
    $('#show-more').hidden = rooms.length <= state.limit;
    $('#show-more').innerHTML =
      `Explore ${Math.min(6, rooms.length - state.limit)} more ${icon('arrow')}`;
    $$('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
  } else if (state.view === 'timetable') renderWeek();
  else renderSources();
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
  $('#time-dialog').close();
}
function navigate(view) {
  state.view = view;
  state.limit = 6;
  render();
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
$('#test-toggle').onclick = () => {
  updateClock();
  $('#time-dialog').showModal();
};
$('#apply-time').onclick = () => {
  if (!state.testing) setSim(state.date, state.minutes);
  $('#time-dialog').close();
};
$('#sim-date').onchange = (event) => {
  if (event.target.value) setSim(event.target.value);
  else event.target.value = state.date;
};
$('#sim-time').onchange = (event) => {
  if (event.target.value) {
    const [h, m] = event.target.value.split(':').map(Number);
    setSim(null, h * 60 + m);
  }
};
$('#minus-time').onclick = () => setSim(null, state.minutes - 15);
$('#plus-time').onclick = () => setSim(null, state.minutes + 15);
$('#reset-time').onclick = realTime;
$$('[data-preset]').forEach(
  (button) =>
    (button.onclick = () => {
      const moments = {
        morning: ['2026-10-19', 630],
        lunch: ['2026-10-19', 780],
        boundary: ['2026-10-19', 660],
        weekend: ['2026-10-18', 630],
      };
      setSim(...moments[button.dataset.preset]);
    }),
);
const dial = $('#time-dial');
let dragging = false;
function drag(event) {
  const box = dial.getBoundingClientRect(),
    x = event.clientX - box.left - box.width / 2,
    y = event.clientY - box.top - box.height / 2;
  const angle = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
  setSim(null, (Math.round(((angle / (Math.PI * 2)) * 1440) / 5) * 5) % 1440);
}
dial.addEventListener('pointerdown', (event) => {
  dragging = true;
  dial.setPointerCapture(event.pointerId);
  drag(event);
});
dial.addEventListener('pointermove', (event) => {
  if (dragging) drag(event);
});
dial.addEventListener('pointerup', () => (dragging = false));
dial.addEventListener('pointercancel', () => (dragging = false));
dial.addEventListener('keydown', (event) => {
  const key = event.key;
  if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End'].includes(key)) {
    event.preventDefault();
    setSim(
      null,
      key === 'Home'
        ? 0
        : key === 'End'
          ? 1435
          : state.minutes +
            (['ArrowRight', 'ArrowUp'].includes(key) ? 1 : -1) * (event.shiftKey ? 60 : 5),
    );
  }
});
$('#search').oninput = (event) => {
  state.query = event.target.value;
  state.limit = 6;
  render();
};
$('#type').onchange = (event) => {
  state.type = event.target.value;
  render();
};
$('#duration').onchange = (event) => {
  state.duration = Number(event.target.value);
  render();
};
$('#show-more').onclick = () => {
  state.limit += 6;
  render();
};
$('#appearance').onclick = () => $('#appearance-dialog').showModal();
$$('.appearance-options [data-theme]').forEach(
  (button) =>
    (button.onclick = () => {
      preference = button.dataset.theme;
      persist('stillspace:theme', preference);
      applyTheme();
    }),
);
$('#reduce-transparency').onchange = (event) => {
  reducedGlass = event.target.checked;
  persist('stillspace:solid', reducedGlass);
  applyTheme();
};
function eventMarkup(event) {
  return `<div class="schedule-event"><time>${time(event.start)}<br>${time(event.end)}</time><div><strong>${esc(event.branch)}</strong><p>${esc(event.text)}</p><button class="source-button" data-source="${event.page}">Scanned source · page ${event.page}</button></div></div>`;
}
function openRoom(id) {
  const room = data.rooms.find((r) => r.id === id);
  if (!room) return;
  const s = roomStatus(room),
    note = notes[id];
  $('#room-detail').innerHTML =
    `<div class="sheet-header"><div><p class="eyebrow">${room.type === 'lab' ? 'LABORATORY' : 'CLASSROOM'} · PEC</p><h2>${esc(room.name)}</h2></div><button data-close class="icon-button" aria-label="Close room details">${icon('close')}</button></div><div class="detail-notice ${s.kind}"><strong>${esc(s.label)}</strong><br>${dateLabel(state.date)}, ${pretty(state.minutes)}–${pretty(state.minutes + state.duration)}<br>${s.kind === 'free' ? 'No mapped CSE class overlaps this stay. Actual occupancy and access remain unknown.' : s.kind === 'busy' ? 'An imported class overlaps at least part of this stay.' : 'This date or interval has no reliable availability claim.'}</div><div class="meta-grid"><div><small>Capacity & amenities</small><span>Not supplied</span></div><div><small>Permission to study</small><span>Check with staff</span></div><div><small>Location</small><span>${esc(room.location)}<br>Floor unverified</span></div><div><small>Evidence</small><span>Partial CSE timetable<br>OCR · needs review</span></div></div><h3 class="detail-heading">${days[weekday(state.date)]}’s schedule</h3>${s.events.length ? s.events.map(eventMarkup).join('') : '<p class="source-explainer">No mapped entries. Unmapped classes and other departments may still use this room.</p>'}<button class="secondary-button full" data-week-room="${id}">Full room week ${icon('arrow')}</button><h3 class="detail-heading">A private note</h3><p class="source-explainer">For you, on this device. Notes are not shared reports and do not change schedule status.</p><div class="local-notes"><button data-note="occupied" data-note-room="${id}">Occupied</button><button data-note="locked" data-note-room="${id}">Locked</button><button data-note="empty" data-note-room="${id}">Looks empty</button><button data-note="clear" data-note-room="${id}">Clear</button></div><p id="local-note" class="local-note">${note ? `You noted “${esc(note.status)}” at ${new Date(note.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. A past note is not current evidence.` : 'No note yet.'}</p>`;
  if (!$('#room-dialog').open) $('#room-dialog').showModal();
}
function openSource(page) {
  const source = data.sources.find((s) => s.page === Number(page));
  if (!source) return;
  $('#source-detail').innerHTML =
    `<div class="sheet-header"><div><p class="eyebrow">ORIGINAL SCAN · PAGE ${source.page}</p><h2>${esc(source.title)}</h2></div><button data-close class="icon-button" aria-label="Close source scan">${icon('close')}</button></div><p class="source-explainer">Effective 09 October 2026. Check OCR room numbers, merged cells and times against this page.</p><button id="zoom-scan" class="secondary-button">Enlarge scan</button><div class="scan-scroll"><img class="source-photo" src="${source.image}" alt="${esc(source.title)} original timetable, page ${source.page}" /></div>`;
  $('#zoom-scan').onclick = () => {
    const zoomed = $('.source-photo').classList.toggle('zoomed');
    $('#zoom-scan').textContent = zoomed ? 'Fit to screen' : 'Enlarge scan';
  };
  if (!$('#source-dialog').open) $('#source-dialog').showModal();
}
function renderWeek() {
  $('#results-summary').textContent = 'Weekly recurrence';
  const room = data.rooms.find((r) => r.id === state.weekRoom) || data.rooms[0];
  if (!room) {
    $('#other-view').innerHTML = '<p class="source-explainer">No timetable loaded.</p>';
    return;
  }
  const events = data.events
    .filter(
      (event) =>
        event.rooms.includes(room.id) &&
        event.day === state.weekDay &&
        (state.weekBranch === 'all' || event.branch === state.weekBranch),
    )
    .sort((a, b) => a.start - b.start);
  $('#other-view').innerHTML =
    `<div class="week-controls"><select id="week-room" aria-label="Room timetable">${data.rooms.map((r) => `<option value="${r.id}" ${r.id === room.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select><select id="week-branch" aria-label="Displayed branch"><option value="all">All branches</option>${data.sources.map((source) => `<option ${source.title === state.weekBranch ? 'selected' : ''}>${esc(source.title)}</option>`).join('')}</select></div><div class="week-days" role="group" aria-label="Day of week">${[1, 2, 3, 4, 5].map((day) => `<button data-week-day="${day}" class="${state.weekDay === day ? 'active' : ''}" aria-pressed="${state.weekDay === day}">${days[day].slice(0, 3)}</button>`).join('')}</div><div class="week-label"><span>${days[state.weekDay]} · ${events.length} entries</span><button data-room="${room.id}">Room details</button></div><div class="week-list">${events.length ? events.map(eventMarkup).join('') : '<p class="source-explainer">No mapped entries for this view. This does not confirm availability.</p>'}</div><p class="source-explainer">Recurring pattern, not an academic calendar. Branch filters only affect this view. Search checks every mapped branch.</p>`;
  $('#week-room').onchange = (event) => {
    state.weekRoom = event.target.value;
    renderWeek();
  };
  $('#week-branch').onchange = (event) => {
    state.weekBranch = event.target.value;
    renderWeek();
  };
}
function renderSources() {
  $('#results-summary').textContent = 'Offline · OCR import';
  $('#other-view').innerHTML =
    `<div class="source-stats"><div><strong>${data.sources.length}</strong><small>Source pages</small></div><div><strong>${data.events.length}</strong><small>Mapped entries</small></div><div><strong>${data.rooms.length}</strong><small>Room references</small></div></div><div class="coverage-warning"><strong>Partial coverage. Honest uncertainty.</strong><br>${data.cellCount} distinct cells; ${data.unresolved.length} have no mapped venue. Other departments, electives, holidays and closures may be missing. Room access, capacity and study permission are unverified.</div><h3 class="source-section-heading">Your timetable, in context.</h3>${data.sources.map((source) => `<div class="source-row"><div>${esc(source.title)}<br><span>Page ${source.page} · ${data.events.filter((event) => event.page === source.page).length} mapped entries</span></div><button data-source="${source.page}" aria-label="Open ${esc(source.title)} source">${icon('arrow')}</button></div>`).join('')}<div class="source-actions"><button id="export-json" class="secondary-button">Export JSON</button><button id="export-csv" class="secondary-button">Export CSV</button></div><details><summary class="source-explainer">Review ${data.unresolved.length} unmapped cells</summary>${data.unresolved.map((cell) => `<div class="schedule-event"><time>p.${cell.page} · ${days[cell.day].slice(0, 3)}<br>${time(cell.start)}–${time(cell.end)}</time><div><strong>${esc(cell.branch)}</strong><p>${esc(cell.text)}</p><button class="source-button" data-source="${cell.page}">Review scan</button></div></div>`).join('')}</details><h3 class="source-section-heading">A timetable is a starting point.</h3><p class="source-explainer">All OCR needs review. The 09 Oct–31 Dec 2026 horizon and 08:00–18:00 window are prototype settings, not official opening hours or a confirmed semester end. Weekends stay unknown. No occupancy model, live feed or room booking is connected.</p><p class="source-explainer">Everything needed to explore is bundled offline. Your saved spaces, appearance and private notes stay on this device.</p>`;
  $('#export-json').onclick = () =>
    download('stillspace-timetable.json', JSON.stringify(data, null, 2), 'application/json');
  $('#export-csv').onclick = () => {
    const rows = [
      ['id', 'room_ids', 'weekday', 'start', 'end', 'branch', 'source_page', 'ocr_text'],
      ...data.events.map((event) => [
        event.id,
        event.rooms.join(';'),
        event.day,
        time(event.start),
        time(event.end),
        event.branch,
        event.page,
        event.text,
      ]),
    ];
    download(
      'stillspace-events.csv',
      rows
        .map((row) => row.map((value) => '"' + String(value).replaceAll('"', '""') + '"').join(','))
        .join('\r\n'),
      'text/csv',
    );
  };
}
function download(name, contents, mime) {
  if (window.StillspaceAndroid?.saveExport) {
    window.StillspaceAndroid.saveExport(name, contents, mime);
    return;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your export is ready.');
}
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) navigate(button.dataset.view);
  if (button.dataset.filter) {
    state.filter = button.dataset.filter;
    state.limit = 6;
    render();
  }
  if (button.dataset.save) {
    const id = button.dataset.save;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    persist('stillspace:saved', [...saved]);
    render();
  }
  if (button.dataset.room) openRoom(button.dataset.room);
  if (button.dataset.source) openSource(button.dataset.source);
  if (button.hasAttribute('data-close')) button.closest('dialog').close();
  if (button.hasAttribute('data-reset-filters')) {
    if (loadError) {
      window.location.reload();
      return;
    }
    state.query = '';
    state.type = 'all';
    state.filter = 'all';
    $('#search').value = '';
    $('#type').value = 'all';
    navigate('explore');
  }
  if (button.dataset.weekRoom) {
    state.weekRoom = button.dataset.weekRoom;
    state.weekDay = Math.min(5, Math.max(1, weekday(state.date)));
    $('#room-dialog').close();
    navigate('timetable');
  }
  if (button.dataset.weekDay) {
    state.weekDay = Number(button.dataset.weekDay);
    renderWeek();
  }
  if (button.dataset.note) {
    const id = button.dataset.noteRoom;
    if (button.dataset.note === 'clear') delete notes[id];
    else notes[id] = { status: button.dataset.note, at: new Date().toISOString() };
    persist('stillspace:notes', notes);
    openRoom(id);
    toast('Private note updated.');
  }
});
for (const dialog of $$('dialog'))
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
window.stillspaceBack = () => {
  const dialogs = $$('dialog[open]');
  if (dialogs.length) {
    dialogs.at(-1).close();
    return true;
  }
  if (state.view !== 'explore') {
    navigate('explore');
    return true;
  }
  return false;
};
setInterval(() => {
  if (!state.testing) {
    const now = campusNow();
    if (now.date !== state.date || now.minutes !== state.minutes) {
      Object.assign(state, now);
      render();
    }
  }
}, 1000);
$('#results').innerHTML = '<p class="loading">Opening your campus…</p>';
try {
  const response = await fetch('/data.json');
  if (!response.ok) throw new Error('Data unavailable');
  data = await response.json();
} catch {
  loadError = true;
}
render();
