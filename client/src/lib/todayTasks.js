export function normalizeTodayTasks(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap((task) => {
    const id = String(task?.id ?? '').trim();
    const text = typeof task?.text === 'string' ? task.text.trim() : '';
    if (!id || id.length > 100 || !text || ids.has(id) || typeof task?.done !== 'boolean') return [];
    ids.add(id);
    return [{ id, text: text.slice(0, 500), done: task.done }];
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
