const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY = { urgent: 1, overdue: 2, normal: 3, completed: 4 };

/** Legacy datetime-local values represent WIB, independent of the server timezone. */
export function parseTaskDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0", , zone] = match;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 ||
      Number(day) > daysInMonth || Number(hour) > 23 ||
      Number(minute) > 59 || Number(second) > 59) return null;
  const timestamp = Date.parse(zone ? value : `${value}+07:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function classifyDeadline(task, now) {
  if (task.status === "selesai") return "completed";
  const deadline = parseTaskDate(task.deadline);
  // Keep malformed legacy records visible; new writes reject invalid dates.
  if (deadline === null) return "normal";
  const remaining = deadline - now;
  if (remaining < 0) return "overdue";
  return remaining < DAY_MS ? "urgent" : "normal";
}

/** Derive reminder fields for this response only; never persist time-dependent state. */
export function prepareTaskList(tasks, now = new Date()) {
  const evaluatedAt = new Date(now);
  const timestamp = evaluatedAt.getTime();
  const result = tasks.map((task) => {
    const deadline = parseTaskDate(task.deadline);
    return {
      ...task,
      deadline: deadline === null ? task.deadline : new Date(deadline).toISOString(),
      deadline_category: classifyDeadline(task, timestamp),
      remaining_seconds: deadline === null ? null : (deadline - timestamp) / 1000
    };
  });

  result.sort((a, b) => {
    const categoryOrder = PRIORITY[a.deadline_category] - PRIORITY[b.deadline_category];
    if (categoryOrder) return categoryOrder;
    const deadlineOrder = a.deadline_category === "urgent" || a.deadline_category === "overdue";
    const first = parseTaskDate(deadlineOrder ? a.deadline : a.created_at) ?? 0;
    const second = parseTaskDate(deadlineOrder ? b.deadline : b.created_at) ?? 0;
    return (deadlineOrder ? first - second : second - first) || a.id - b.id;
  });

  return { evaluated_at: evaluatedAt.toISOString(), tasks: result };
}
