// Business timezone used for day/month grouping in reports
const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days, from = new Date()) =>
  new Date(from.getTime() - days * DAY_MS);

// YYYY-MM-DD in the business timezone
const toDayKey = (date) =>
  new Date(date).toLocaleDateString("en-CA", { timeZone: TIMEZONE });

// YYYY-MM in the business timezone
const toMonthKey = (date) => toDayKey(date).slice(0, 7);

const percentChange = (current, previous) => {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

// UTC offset of the business timezone (India has no daylight saving)
const TZ_OFFSET = process.env.TZ_OFFSET || "+05:30";

const isDayKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Start / end of a YYYY-MM-DD day in the business timezone
const startOfDay = (dayKey) => new Date(`${dayKey}T00:00:00.000${TZ_OFFSET}`);
const endOfDay = (dayKey) => new Date(`${dayKey}T23:59:59.999${TZ_OFFSET}`);

module.exports = {
  TIMEZONE,
  TZ_OFFSET,
  DAY_MS,
  daysAgo,
  toDayKey,
  toMonthKey,
  percentChange,
  isDayKey,
  startOfDay,
  endOfDay,
};
