const buckets = new Map();

function rateLimit({ windowMs = 60_000, max = 20 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.method}:${req.originalUrl}`;
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    next();
  };
}

module.exports = { rateLimit };
