export const SCHEDULE_META_KEY = '__lehrermaps_schedule_meta_v1';
export const PERIOD_COUNT = 6;
export const BREAKS = [
  { key: 'break-fruehstueck', label: 'Pause 1' },
  { key: 'break-mittag', label: 'Pause 2' },
];

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeRange(start, end) {
  return TIME_PATTERN.test(start || '') && TIME_PATTERN.test(end || '') && start < end;
}

function normalizeRange(range) {
  return {
    start: typeof range?.start === 'string' ? range.start : '',
    end: typeof range?.end === 'string' ? range.end : '',
  };
}

export function getScheduleSettings(schedule) {
  const metadata = schedule?.[SCHEDULE_META_KEY];
  const storedPeriods = metadata?.periods;
  if (!Array.isArray(storedPeriods) || storedPeriods.length !== PERIOD_COUNT) {
    return { periods: [], breaks: [], configured: false };
  }
  const periods = storedPeriods.map((period, index) => ({ block: index + 1, ...normalizeRange(period) }));
  const storedBreaks = metadata?.breaks;
  const hasBreakConfiguration = Array.isArray(storedBreaks) && storedBreaks.length === BREAKS.length;
  const breaks = BREAKS.map((breakInfo, index) => ({ ...breakInfo, ...normalizeRange(hasBreakConfiguration ? storedBreaks[index] : null) }));
  const timeline = [
    periods[0], periods[1], breaks[0], periods[2], periods[3], breaks[1], periods[4], periods[5],
  ];
  const periodsConfigured = periods.every((period, index) => isValidTimeRange(period.start, period.end)
    && (index === 0 || periods[index - 1].end <= period.start));
  // Version 1 schedules only had lesson times. Keep those usable, but never
  // invent break times or include old break entries in the clock calculation.
  const configured = hasBreakConfiguration
    ? timeline.every((entry, index) => isValidTimeRange(entry.start, entry.end)
      && (index === 0 || timeline[index - 1].end <= entry.start))
    : periodsConfigured;
  return { periods, breaks, configured, hasBreakConfiguration, timeline };
}

export function withScheduleSettings(schedule, periods, breaks) {
  return {
    ...schedule,
    [SCHEDULE_META_KEY]: {
      version: 2,
      periods: periods.map(({ start, end }) => ({ start, end })),
      breaks: breaks.map(({ start, end }) => ({ start, end })),
    },
  };
}

function atTime(date, value) {
  const [hours, minutes] = value.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function entryForBreak(schedule, breakKey, day) {
  const entry = schedule?.[breakKey]?.[day];
  if (!entry) return null;
  const details = typeof entry === 'object' ? entry : {};
  return { ...details, label: details.label || 'Aufsicht' };
}

export function lessonsForDate(schedule, date) {
  const { periods, breaks, configured, hasBreakConfiguration } = getScheduleSettings(schedule);
  if (!configured || date.getDay() === 0 || date.getDay() === 6) return [];
  const day = date.getDay() - 1;
  const lessonEntries = periods.flatMap((period, index) => {
    const cell = schedule?.[`${day}-${index}`];
    if (!cell?.label) return [];
    return [{
      ...cell,
      block: index + 1,
      blockLabel: `Block ${index + 1}`,
      start: atTime(date, period.start),
      end: atTime(date, period.end),
      time: `${period.start}–${period.end}`,
    }];
  });
  const breakEntries = hasBreakConfiguration ? breaks.flatMap((breakInfo) => {
    const entry = entryForBreak(schedule, breakInfo.key, day);
    if (!entry) return [];
    return [{
      ...entry,
      block: breakInfo.label,
      blockLabel: breakInfo.label,
      isBreak: true,
      start: atTime(date, breakInfo.start),
      end: atTime(date, breakInfo.end),
      time: `${breakInfo.start}–${breakInfo.end}`,
    }];
  }) : [];
  return [...lessonEntries, ...breakEntries].sort((a, b) => a.start - b.start || String(a.block).localeCompare(String(b.block)));
}

export function getCockpitLesson(schedule, now = new Date()) {
  const settings = getScheduleSettings(schedule);
  if (!settings.configured) return { kind: 'no-time-config' };
  const todayLessons = lessonsForDate(schedule, now);
  const current = todayLessons.find((lesson) => lesson.start <= now && now < lesson.end);
  if (current) return { kind: 'current', lesson: current };
  const laterToday = todayLessons.find((lesson) => lesson.start > now);
  if (laterToday) return { kind: 'next', lesson: laterToday };
  for (let offset = 1; offset <= 7; offset += 1) {
    const future = new Date(now);
    future.setDate(now.getDate() + offset);
    const lesson = lessonsForDate(schedule, future)[0];
    if (lesson) return { kind: 'next', lesson };
  }
  return { kind: 'no-lessons' };
}

export function remainingMinutes(lesson, now = new Date()) {
  return Math.max(0, Math.ceil((lesson.end.getTime() - now.getTime()) / 60_000));
}
