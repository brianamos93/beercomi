import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import { sanitizeLog } from "./sanitizerLog";

export const apiLogger = (req: Request, res: Response, next: NextFunction) => {
	const start = Date.now();

	const originalSend = res.send;

	let responseBody: any;

	res.send = function (body) {
		responseBody = body;
		return originalSend.call(this, body);
	};

	res.on("finish", () => {
		const duration = Date.now() - start;

		logger.info({
			method: req.method,
			url: req.originalUrl,
			status: res.statusCode,
			duration: `${duration}ms`,
			requestBody: sanitizeLog(req.body),
			responseBody: sanitizeLog(responseBody),
			ip: req.ip,
		});
	});

	next();
};