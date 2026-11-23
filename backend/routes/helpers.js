export const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const nonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
export const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= 2147483647;

export function validateId(req, res, next, value) {
  if (!validId(value)) return res.status(404).json({ error: "Data tidak ditemukan." });
  next();
}
