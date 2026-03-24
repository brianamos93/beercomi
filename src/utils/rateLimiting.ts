import { rateLimit } from 'express-rate-limit'

export const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
    ipv6Subnet: 56,

    // Add this:
    keyGenerator: (req) => {
        const forwarded = req.headers['x-forwarded-for'];
        const ip = Array.isArray(forwarded)
            ? forwarded[0]
            : forwarded?.split(',')[0]?.trim();
        return ip || req.ip || 'unknown';
    },
})