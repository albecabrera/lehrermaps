export const SCHEDULE_META_KEY = '__lehrermaps_schedule_meta_v1';
export const PERIOD_COUNT = 6;

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeRange(start, end) {
  return TIME_PATTERN.test(start || '') && TIME_PATTERN.test(end || '') && start < end;
}

export function getScheduleSettings(schedule) {
  const periods = schedule?.[SCHEDULE_META_KEY]?.periods;
  if (!Array.isArray(periods) || periods.length !== PERIOD_COUNT) return { periods: [], configured: false };
  const normalized = periods.map((period, index) => ({
    block: index + 1,
    start: typeof period?.start === 'string' ? period.start : '',
    end: typeof period?.end === 'string' ? period.end : '',
  }));
  const configured = normalized.every((period, index) => isValidTimeRange(period.start, period.end)
    && (index === 0 || normalized[index - 1].end <= period.start));
  return { periods: normalized, configured };
}

export function withScheduleSettings(schedule, periods) {
  return {
    ...schedule,
    [SCHEDULE_META_KEY]: { version: 1, periods: periods.map(({ start, end }) => ({ start, end })) },
  };
}

function atTime(date, value) {
  const [hours, minutes] = value.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function lessonsForDate(schedule, date) {
  const { periods, configured } = getScheduleSettings(schedule);
  if (!configured || date.getDay() === 0 || date.getDay() === 6) return [];
  const day = date.getDay() - 1;
  return periods.flatMap((period, index) => {
    const cell = schedule?.[`${day}-${index}`];
    if (!cell?.label) return [];
    return [{
      ...cell,
      block: index + 1,
      start: atTime(date, period.start),
      end: atTime(date, period.end),
      time: `${period.start}–${period.end}`,
    }];
  }).sort((a, b) => a.start - b.start || a.block - b.block);
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
