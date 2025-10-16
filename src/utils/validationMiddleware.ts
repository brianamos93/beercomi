import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

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



export const validationHandler = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Normalize strings
      let data = normalizeRequestBody(req.body);

      // Merge file(s) if they exist
      if (req.file) data.cover_image = req.file;
      if (req.files) data.photos = req.files;

      const result = schema.safeParse(data);
      if (!result.success) {
        const errors = result.error.issues.map(i => ({
          path: i.path.join("."),
          message: i.message,
        }));
        return res.status(400).json({ errors });
      }

      req.body = result.data; // sanitized, parsed
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Validation handler failed" });
    }
  };
};
