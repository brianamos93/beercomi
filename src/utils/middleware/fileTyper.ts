import { Request, Response, NextFunction } from 'express';

export const fileValidator = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) return next();

  if (!req.file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Invalid image type" });
  }

  next();
};