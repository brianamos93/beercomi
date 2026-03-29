import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	logger.error(err.stack);
	if (err.message === "INVALID_TOKEN") {
		return res.status(401).json({ error: "token invalid" });
	}

	if (err.message === "EMAIL_IN_USE") {
		return res.status(401).json({ error: "email in use or not valid" });
	}

	if (err.message === "DISPLAY_NAME_IN_USE") {
		return res.status(401).json({ error: "display name in use or not valid" });
	}

	if (err.message === "NO_AVATAR") {
		return res.status(401).json({ error: "no avatar found" });
	}

	if (err.message === "NO_FILE") {
		res.status(400).json({ error: "No file uploaded" });
	}
	
	if(err.message === "INVALID_EMAIL_OR_PASSWORD") {
		res.status(401).json({error: "Invalid email or password"})
	}
	
	if(err.message === "NOT_AUTHORIZED") {
		res.status(401).json({error: "Not authorized"})
	}

	if(err.message === "NO_BREWERY") {
		res.status(404).json({error: "Brewery not found"})
	}

	res.status(500).json({
		message: "Internal Server Error",
	});
};
