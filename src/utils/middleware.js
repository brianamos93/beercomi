const logger = require('./logger')
const jwt = require('jsonwebtoken')

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

const authenticationHandler = (req, res, next) => {
 
  const token = getTokenFrom(req)
  
  if (!token) return res.status(401).send({error: 'Not Authorized'})

    jwt.verify(token, process.env.SECRET, (err, user) => {
      if(err) return res.status(403).send({error: "Error"})
        req.user = user
        next()
    })
}

module.exports = {
  requestLogger,
  unknownEndpoint,
  errorHandler
}