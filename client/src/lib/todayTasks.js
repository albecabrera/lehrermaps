const DATE_PATTERN = /^20(?:0\d|[1-9]\d)-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validDueDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toISOString().slice(0, 10) === value;
}

export function normalizeTodayTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap((task) => {
    const id = String(task?.id ?? '').trim();
    const text = typeof task?.text === 'string' ? task.text.trim() : '';
    if (!id || id.length > 100 || !text || ids.has(id) || typeof task?.done !== 'boolean') return [];
    ids.add(id);
    const dueDate = validDueDate(task?.dueDate) ? task.dueDate : '';
    const dueTime = dueDate && typeof task?.dueTime === 'string' && TIME_PATTERN.test(task.dueTime) ? task.dueTime : '';
    return [{ id, text: text.slice(0, 500), done: task.done, ...(dueDate ? { dueDate } : {}), ...(dueTime ? { dueTime } : {}) }];
  }).slice(0, 20);
}

/** Keeps each completion group in its existing order. */
export function orderTasksByCompletion(tasks) {
  const normalized = normalizeTodayTasks(tasks);
  return [
    ...normalized.filter((task) => !task.done),
    ...normalized.filter((task) => task.done),
  ];
}

export function toggleTodayTask(tasks, taskId) {
  const ordered = orderTasksByCompletion(tasks);
  const task = ordered.find((item) => item.id === taskId);
  if (!task) return ordered;
  const toggled = { ...task, done: !task.done };
  const remaining = ordered.filter((item) => item.id !== taskId);
  const incomplete = remaining.filter((item) => !item.done);
  const completed = remaining.filter((item) => item.done);
  return toggled.done ? [...incomplete, ...completed, toggled] : [...incomplete, toggled, ...completed];
}

export function updateTodayTaskText(tasks, taskId, text) {
  const nextText = String(text ?? '').trim().slice(0, 500);
  if (!nextText) return tasks;
  return tasks.map((task) => (task.id === taskId ? { ...task, text: nextText } : task));
}

export function updateTodayTaskDue(tasks, taskId, dueDate, dueTime) {
  const validDate = validDueDate(dueDate) ? dueDate : '';
  const validTime = validDate && TIME_PATTERN.test(dueTime || '') ? dueTime : '';
  return tasks.map((task) => {
    if (task.id !== taskId) return task;
    const next = { ...task };
    if (validDate) next.dueDate = validDate; else delete next.dueDate;
    if (validTime) next.dueTime = validTime; else delete next.dueTime;
    return next;
  });
}

export function taskDueAt(task) {
  if (!validDueDate(task?.dueDate) || !TIME_PATTERN.test(task?.dueTime || '')) return null;
  const due = new Date(`${task.dueDate}T${task.dueTime}:00`);
  return Number.isNaN(due.getTime()) ? null : due;
}

export function isTaskReminderEligible(task, now = new Date()) {
  const due = taskDueAt(task);
  return Boolean(due && !task?.done && due.getTime() <= now.getTime());
}
