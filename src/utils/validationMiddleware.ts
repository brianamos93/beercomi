import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { ParamsDictionary } from "express-serve-static-core";

const normalizeRequestBody = (body: Record<string, any>) => {
	const normalized: Record<string, any> = {};
	for (const key in body) {
		const value = body[key];
		if (typeof value === "string") {
			// Remove CRLF and trim spaces
			normalized[key] = value.replace(/[\r\n]+/g, "").trim();
		} else {
			normalized[key] = value;
		}
	}
	return normalized;
};

export const validationHandler = (
	schema: ZodType,
	source: "body" | "params" | "query" = "body" // default is body
) => {
	return (req: Request, res: Response, next: NextFunction) => {
		try {
			let data;

			// Pick the correct input source
			if (source === "body") {
				data = normalizeRequestBody(req.body);

				// Merge file(s) if they exist (body-only)
				if (req.file) data.cover_image = req.file;
				if (req.files) data.photos = req.files;
			} else if (source === "params") {
				data = req.params;
			} else if (source === "query") {
				data = req.query;
			}

			const result = schema.safeParse(data);
			if (!result.success) {
				const errors = result.error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				}));
				return res.status(400).json({ errors });
			}

			// Save validated data back
			if (source === "body") {
				req.body = result.data;
			} else if (source === "params") {
				req.params = result.data as unknown as ParamsDictionary;
			} else if (source === "query") {
				req.query = result.data as any;
			}

			next();
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Validation handler failed" });
		}
	};
};
