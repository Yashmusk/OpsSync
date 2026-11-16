// Small in-memory rate limiter (per server process).
// keyFn picks what to count by, e.g. IP or IP + email.
const createRateLimit = ({ windowMs, max, message, keyFn = (req) => req.ip }) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);

    if (recent.length >= max) {
      return res.status(429).json({ success: false, message });
    }

    recent.push(now);
    hits.set(key, recent);

    // Occasionally drop stale keys so the map doesn't grow forever
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (!times.some((time) => now - time < windowMs)) hits.delete(k);
      }
    }

    return next();
  };
};

module.exports = { createRateLimit };
