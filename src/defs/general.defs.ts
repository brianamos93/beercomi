import { Request } from "express";
export interface MulterRequest<T = unknown> extends Request {
	file?: Express.Multer.File;
	body: T;
}