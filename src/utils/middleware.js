const logger = require('./logger')
const jwt = require('jsonwebtoken')
const { getTokenFrom } = require('./userlib');

const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method)
  logger.info('Path:  ', request.path)
  logger.info('Body:  ', request.body)
  logger.info('Headers: ', request.headers)
  logger.info('---')
  next()
}

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: 'unknown endpoint' })
}

const errorHandler = (error, request, response, next) => {
  if (error.name === 'CastError') {
    return response.status(400).send({ error: 'malformatted id' })
  } else if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message })
  }  else if (error.name ===  'JsonWebTokenError') {
    return response.status(400).json({ error: 'token missing or invalid' })
  }

  next(error)
}

// Use CommonJS style and do NOT call this when registering middleware.
// Register as: app.use(authenticationHandler) or router.use(authenticationHandler)
const authenticationHandler = (req, res, next) => {
  try {
    const token = getTokenFrom(req);

    // No token extracted
    if (!token) {
      return res.status(401).json({ error: "Not authorized: missing or malformed token" });
    }

    // Verify token
    jwt.verify(token, process.env.SECRET, (err, user) => {
      if (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Attach decoded user data to request
      req.user = user;
      next();
    });
  } catch (error) {
    // Defensive: if res is undefined, log and pass to next()
    if (!res || typeof res.status !== 'function') {
      console.error('authenticationHandler error (no res):', error);
      return next ? next(error) : undefined;
    }
    return res.status(400).json({ error: "Bad request: malformed Authorization header" });
  }
};

module.exports = {
  requestLogger,
  unknownEndpoint,
  errorHandler,
  authenticationHandler
}