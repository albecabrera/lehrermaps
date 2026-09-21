const SCHEDULE_META_KEY = '__lehrermaps_schedule_meta_v1';
const PERIOD_COUNT = 6;
const BREAKS = [
  { key: 'break-fruehstueck', position: 2 },
  { key: 'break-mittag', position: 5 },
];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.getUTCFullYear() === Number(match[1])
    && parsed.getUTCMonth() === Number(match[2]) - 1
    && parsed.getUTCDate() === Number(match[3]);
}

function validRange(range) {
  return TIME_PATTERN.test(range?.start || '')
    && TIME_PATTERN.test(range?.end || '')
    && range.start < range.end;
}

function normalizeText(value, maxLength) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function parseSchedule(value) {
  if (typeof value !== 'string' || !value) return {};
  try {
    return JSON.parse(value);
  } catch {
    try { return JSON.parse(value.replaceAll('\\"', '"')); } catch { return {}; }
  }
}

function scheduleSettings(schedule) {
  const metadata = schedule?.[SCHEDULE_META_KEY];
  if (!Array.isArray(metadata?.periods) || metadata.periods.length !== PERIOD_COUNT) {
    return { configured: false, periods: [], breaks: [], hasBreaks: false };
  }
  const periods = metadata.periods.map((range) => ({ start: range?.start, end: range?.end }));
  const periodsConfigured = periods.every((period, index) => validRange(period)
    && (index === 0 || periods[index - 1].end <= period.start));
  const hasBreaks = Array.isArray(metadata.breaks) && metadata.breaks.length === BREAKS.length;
  const breaks = hasBreaks
    ? metadata.breaks.map((range, index) => ({ ...BREAKS[index], start: range?.start, end: range?.end }))
    : [];
  if (!periodsConfigured) return { configured: false, periods: [], breaks: [], hasBreaks: false };
  if (hasBreaks) {
    const timeline = [periods[0], periods[1], breaks[0], periods[2], periods[3], breaks[1], periods[4], periods[5]];
    const breaksConfigured = timeline.every((entry, index) => validRange(entry)
      && (index === 0 || timeline[index - 1].end <= entry.start));
    if (!breaksConfigured) return { configured: false, periods: [], breaks: [], hasBreaks: false };
  }
  return { configured: true, periods, breaks, hasBreaks };
}

function weekdayIndex(date) {
  const value = new Date(`${date}T12:00:00`);
  const weekday = value.getDay();
  return weekday === 0 || weekday === 6 ? null : weekday - 1;
}

function lessonSlot(cell, period, block) {
  const label = normalizeText(cell?.label, 80);
  if (!label) return null;
  return {
    label,
    room: normalizeText(cell?.location ?? cell?.room, 40),
    start: period.start,
    end: period.end,
    type: 'lesson',
    block,
  };
}

function breakSlot(schedule, breakInfo, day) {
  const value = schedule?.[breakInfo.key]?.[day];
  if (!value) return null;
  const entry = typeof value === 'object' ? value : {};
  return {
    label: normalizeText(entry.label, 80) || 'Aufsicht',
    room: normalizeText(entry.location ?? entry.room, 40),
    start: breakInfo.start,
    end: breakInfo.end,
    type: 'break',
    block: breakInfo.key,
  };
}

export function slotsForDate(schedule, date) {
  const settings = scheduleSettings(schedule);
  const day = weekdayIndex(date);
  if (!settings.configured || day === null) return { configured: settings.configured, slots: [] };
  const lessons = settings.periods.flatMap((period, index) => {
    const slot = lessonSlot(schedule?.[`${day}-${index}`], period, index + 1);
    return slot ? [slot] : [];
  });
  const breaks = settings.hasBreaks ? settings.breaks.flatMap((breakInfo) => {
    const slot = breakSlot(schedule, breakInfo, day);
    return slot ? [slot] : [];
  }) : [];
  return {
    configured: true,
    slots: [...lessons, ...breaks].sort((left, right) => left.start.localeCompare(right.start) || String(left.block).localeCompare(String(right.block))),
  };
}

function localDate(now) {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function localTime(now) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function scheduleSummary(schedule, date, now = new Date()) {
  const result = slotsForDate(schedule, date);
  if (!result.configured) return { configured: false, current: null, next: null, slots: [] };
  const requestedIsToday = date === localDate(now);
  const requestedIsFuture = date > localDate(now);
  const time = localTime(now);
  const current = requestedIsToday
    ? result.slots.find((slot) => slot.start <= time && time < slot.end) || null
    : null;
  const next = requestedIsToday
    ? result.slots.find((slot) => slot.start > time) || null
    : (requestedIsFuture ? result.slots[0] || null : null);
  const firstRelevantIndex = current
    ? result.slots.indexOf(current)
    : next ? result.slots.indexOf(next) : 0;
  return {
    configured: true,
    current,
    next,
    slots: result.slots.slice(firstRelevantIndex, firstRelevantIndex + 3),
  };
}

export function openTaskCount(value) {
  if (typeof value !== 'string' || value.length > 32_768) return 0;
  try {
    const tasks = JSON.parse(value);
    if (!Array.isArray(tasks) || tasks.length > 20) return 0;
    return tasks.filter((task) => task && task.done === false).length;
  } catch {
    return 0;
  }
}

export function safeAppointment(rows) {
  const row = rows.find((candidate) => validDate(String(candidate?.exam_date || '').slice(0, 10)));
  if (!row) return null;
  const time = TIME_PATTERN.test(String(row.exam_time || '').slice(0, 5))
    ? String(row.exam_time).slice(0, 5)
    : null;
  return { date: String(row.exam_date).slice(0, 10), time };
}
