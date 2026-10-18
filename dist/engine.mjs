export const VALID_FROM = '2026-10-09',
  VALID_TO = '2026-12-31';
export function campusNow(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
export function weekday(date) {
  return new Date(date + 'T12:00:00+05:30').getUTCDay();
}
export function overlaps(a, b, c, d) {
  return a < d && b > c;
}
export function time(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function pretty(m) {
  return new Date(2000, 0, 1, 0, m).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
export function status(room, events, date, start, duration) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isInteger(start) ||
    start < 0 ||
    start > 1439 ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    start + duration > 1440
  )
    return { kind: 'unknown', label: 'Invalid interval', events: [] };
  const parsed = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    return { kind: 'unknown', label: 'Invalid date', events: [] };
  const day = weekday(date),
    all = events
      .filter((e) => e.rooms.includes(room.id) && e.day === day)
      .sort((a, b) => a.start - b.start),
    hits = all.filter((e) => overlaps(start, start + duration, e.start, e.end));
  if (date < VALID_FROM || date > VALID_TO)
    return { kind: 'unknown', label: 'Outside source period', events: all };
  if (day === 0 || day === 6)
    return { kind: 'unknown', label: 'Weekend · hours unknown', events: all };
  if (start < 480 || start + duration > 1080)
    return { kind: 'unknown', label: 'Outside reviewed hours', events: all };
  if (hits.length)
    return {
      kind: 'busy',
      label: hits.some((e) => e.start <= start && e.end > start)
        ? 'Scheduled class'
        : 'Class during your stay',
      events: all,
      hits,
    };
  const next = all.find((e) => e.start >= start + duration);
  return { kind: 'free', label: 'CSE schedule gap', events: all, next, until: next?.start ?? 1080 };
}
export function validateImport(data) {
  if (!Array.isArray(data)) throw new Error('Expected an array of timetable events.');
  const seen = new Set();
  return data
    .map((e, i) => {
      if (
        !e ||
        !Array.isArray(e.rooms) ||
        !e.rooms.length ||
        e.rooms.some((r) => typeof r !== 'string') ||
        !Number.isInteger(e.day) ||
        e.day < 1 ||
        e.day > 5 ||
        !Number.isInteger(e.start) ||
        !Number.isInteger(e.end) ||
        e.start < 0 ||
        e.end > 1440 ||
        e.start >= e.end ||
        typeof e.text !== 'string'
      )
        throw new Error(`Invalid event at row ${i + 1}.`);
      const key = JSON.stringify([
        e.rooms.slice().sort(),
        e.day,
        e.start,
        e.end,
        e.text,
        e.branch,
        e.page,
      ]);
      if (seen.has(key)) return null;
      seen.add(key);
      return e;
    })
    .filter(Boolean);
}
