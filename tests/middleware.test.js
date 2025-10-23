const { 
  requestLogger, 
  unknownEndpoint, 
  errorHandler, 
  authenticationHandler 
} = require('../src/utils/middleware');

const jwt = require('jsonwebtoken');
const { getTokenFrom } = require('../src/utils/userlib');
const logger = require('../src/utils/logger');

jest.mock('jsonwebtoken');
jest.mock('../src/utils/userlib');
jest.mock('../src/utils/logger');

describe('Middleware', () => {

  describe('requestLogger', () => {
    it('should log method, path, body, headers and call next', () => {
      const req = { method: 'GET', path: '/test', body: { a: 1 }, headers: { authorization: 'token' } };
      const res = {};
      const next = jest.fn();

      requestLogger(req, res, next);

      expect(logger.info).toHaveBeenCalledWith('Method:', 'GET');
      expect(logger.info).toHaveBeenCalledWith('Path:  ', '/test');
      expect(logger.info).toHaveBeenCalledWith('Body:  ', { a: 1 });
      expect(logger.info).toHaveBeenCalledWith('Headers: ', { authorization: 'token' });
      expect(logger.info).toHaveBeenCalledWith('---');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('unknownEndpoint', () => {
    it('should respond with 404 and error message', () => {
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      unknownEndpoint(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ error: 'unknown endpoint' });
    });
  });

  describe('errorHandler', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
      next = jest.fn();
    });

    it('should handle CastError', () => {
      const error = { name: 'CastError' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'malformatted id' });
    });

    it('should handle ValidationError', () => {
      const error = { name: 'ValidationError', message: 'invalid' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid' });
    });

    it('should handle JsonWebTokenError', () => {
      const error = { name: 'JsonWebTokenError' };
      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'token missing or invalid' });
    });

    it('should call next for unknown errors', () => {
      const error = { name: 'OtherError' };
      errorHandler(error, req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('authenticationHandler', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {} };
      res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      next = jest.fn();
    });

    it('should return 401 if token missing', () => {
      getTokenFrom.mockReturnValue(null);

      authenticationHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Not authorized: missing or malformed token" });
    });

    it('should return 401 if token invalid', () => {
      getTokenFrom.mockReturnValue('token');
      jwt.verify.mockImplementation((token, secret, cb) => cb(new Error('fail'), null));

      authenticationHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    });

    it('should attach user to request if token valid', () => {
      const user = { id: '123' };
      getTokenFrom.mockReturnValue('token');
      jwt.verify.mockImplementation((token, secret, cb) => cb(null, user));

      authenticationHandler(req, res, next);

      expect(req.user).toEqual(user);
      expect(next).toHaveBeenCalled();
    });

    it('should catch malformed header errors', () => {
      getTokenFrom.mockImplementation(() => { throw new Error('bad header'); });
      authenticationHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Bad request: malformed Authorization header" });
    });
  });
});
