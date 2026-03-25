import { rateLimit } from 'express-rate-limit'

export const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
    ipv6Subnet: 56,
})