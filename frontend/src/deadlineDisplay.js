export function formatDeadline(deadline) {
  const date = new Date(deadline);
  if (!Number.isFinite(date.getTime())) return "Tanggal tidak valid";
  return `${date.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  })} WIB`;
}

export function formatRemaining(seconds, category) {
  if (!Number.isFinite(seconds)) return "";
  const overdue = category === "overdue";
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) {
    return overdue ? "Terlambat kurang dari 1 menit" : seconds === 0 ? "Deadline sekarang" : "Sisa kurang dari 1 menit";
  }
  const minutes = overdue ? Math.floor(magnitude / 60) : Math.ceil(magnitude / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts = [];
  if (days) parts.push(`${days} hari`);
  if (hours) parts.push(`${hours} jam`);
  if (rest && !days) parts.push(`${rest} menit`);
  return `${overdue ? "Terlambat" : "Sisa"} ${parts.join(" ")}`;
}
