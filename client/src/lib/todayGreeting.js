export const TODAY_GREETING_NAME = 'Cabrera';

export function getTodayGreeting(date = new Date(), name = TODAY_GREETING_NAME) {
  const day = date.getDay();
  if (day === 0 || day === 6) return 'Schönes Wochenende!';
  const greeting = date.getHours() < 12 ? 'Guten Morgen' : date.getHours() < 18 ? 'Guten Tag' : 'Guten Abend';
  return `${greeting} ${name}!`;
}
