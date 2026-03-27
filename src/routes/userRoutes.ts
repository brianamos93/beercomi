import { Router, Request } from "express";

import multer from "multer";
import { FileFilterCallback } from "multer";
import validate from "express-zod-safe";
import {
	LoginSchema,
	PasswordChangeSchema,
	RoleInputSchema,
	SignupSchema,
} from "../schemas/userSchemas";
import { idParamSchema } from "../schemas/generalSchemas";
import { fileValidator } from "../utils/middleware/fileTyper";
import { UserController } from "../controllers/user.controller";
import express from "express";

const { authenticationHandler } = require("../utils/middleware");

const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback,
) => {
	const allowedTypes = ["image/jpeg", "image/png"];
	if (allowedTypes.includes(file.mimetype)) cb(null, true);
	else cb(new Error("Only .jpeg and .png files are allowed"));
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });

const router = Router();



router.post(
	"/login",
	express.json(),
	validate({ body: LoginSchema }),
	UserController.login
);

router.post(
	"/profile/img/upload",
	authenticationHandler,
	upload.single("image"),
	fileValidator,
	UserController.uploadAvatar
);

router.delete(
	"/profile/img",
	authenticationHandler,
	express.json(),
	UserController.deleteAvatar
);


router.post(
	"/signup",
	express.json(),
	validate({ body: SignupSchema }),
	UserController.signup
);

router.get("/user", express.json(), UserController.getLoggedInUser);

router.get(
	"/user/:id",
	express.json(),
	validate({ params: idParamSchema }),
	UserController.getUser
);

router.delete(
	"/user/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	UserController.deleteUser
);

router.put(
	"/user/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema, body: PasswordChangeSchema }),
	UserController.changePassword
);

router.put(
	"/user/:id/role",
	express.json(),
	validate({ params: idParamSchema, body: RoleInputSchema }),
	UserController.updateRole
);

router.get(
	"/user/:id/recentactivity",
	validate({ params: idParamSchema }),
	UserController.getRecentActivity,
);

export default router;
