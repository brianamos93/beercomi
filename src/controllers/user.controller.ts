// controllers/activityController.ts
import { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/user.models";
import { decodeToken } from "../utils/userlib";
import path from "path";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
import fs from "fs";
import sharp from "sharp";

export const UserController = {
	async getRecentActivity(req: Request, res: Response, next: NextFunction) {
		try {
			const userId = req.params.id;
			const tables = await UserModel.getTablesWithActivityColumns();

			if (!tables.length) return [];

			const entries = UserModel.getRecentActivityFromTables(tables, userId);

			res.json(entries);
		} catch (error) {
			next(error);
		}
	},
	async getLoggedInUser(req: Request, res: Response, next: NextFunction) {
		try {
			const decodedToken = decodeToken(req);
			if (!decodedToken.id) throw new Error("INVALID_TOKEN");
			const userData = await UserModel.getTokenUser(decodeToken);
			return res.status(200).json(userData);
		} catch (error) {
			next(error);
		}
	},
	async signup(req: Request, res: Response, next: NextFunction) {
		const { display_name, email, password } = req.body;
		const saltRounds = 10;
		const passwordHash = await bcrypt.hash(password, saltRounds);

		try {
			const emailData = await UserModel.emailCheck(email);
			if (emailData.rowCount != 0) throw new Error("EMAIL_IN_USE");

			const displayNameData = await UserModel.displayNameCheck(display_name);
			if (displayNameData.rowCount != 0) throw new Error("DISPLAY_NAME_IN_USE");

			const result = await UserModel.signup({
				email: email,
				passwordHash: passwordHash,
				display_name: display_name,
			});

			res.status(201).json(result);
		} catch (error) {
			next(error);
		}
	},
	async deleteAvatar(req: Request, res: Response, next: NextFunction) {
		try {
			const userId = req.user!.id;
			const avatardir = req.user!.profile_img_url;
			if (!avatardir) throw new Error("NO_AVATAR");
			const oldFilePath = path.join(__dirname, "..", "uploads", avatardir);
			if (fs.existsSync(oldFilePath)) {
				fs.unlinkSync(oldFilePath);
			}

			UserModel.removeAvatar(userId);
			return res.status(200).json({ message: "Avatar Successfully Deleted." });
		} catch (error) {
			next(error);
		}
	},
	async uploadAvatar(req: Request, res: Response, next: NextFunction) {
		const uploadPath = path.join(__dirname, "..", "uploads", "users");
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath);
		}
		try {
			if (!req.file) throw new Error("NO_FILE");
			const ext: string =
				req.file && req.file.originalname
					? path.extname(req.file.originalname)
					: "";
			const userId = req.user!.id;
			const avatardir = req.user!.profile_img_url;
			const display_name = req.user!.display_name;
			const newFileName = `${display_name}-${Date.now()}${ext}`;
			const uploadFilePathAndFile = path.join(uploadPath, newFileName);

			if (avatardir !== null) {
				const oldFilePath = path.join(__dirname, "..", "uploads", avatardir);
				if (fs.existsSync(oldFilePath)) {
					fs.unlinkSync(oldFilePath);
				}
			}
			await sharp(req.file.buffer)
				.resize(800, 600, { fit: "cover" })
				.toFile(uploadFilePathAndFile);
			const relativeUploadFilePathAndFile = "/uploads/users/" + newFileName;
			UserModel.uploadAvatar({
				filepath: relativeUploadFilePathAndFile,
				userId: userId,
			});
			res.status(200).json({ message: "Upload Sucessful" });
		} catch (error) {
			next(error);
		}
	},
	async login(req: Request, res: Response, next: NextFunction) {
		const { email, password } = req.body;
		try {
			const userData = await UserModel.emailCheck(email);
			if (userData.rowCount === 0) throw new Error("INVALID_EMAIL_OR_PASSWORD");

			const passwordCorrect =
				userData === null
					? false
					: await bcrypt.compare(password, userData.rows[0].password);
			if (!(userData && passwordCorrect))
				throw new Error("INVALID_EMAIL_OR_PASSWORD");

			const userForToken = {
				id: userData.rows[0].id,
			};
			const token = jwt.sign(userForToken, process.env.SECRET, {
				expiresIn: 60 * 60,
			});
			res.status(200).send({ token, userForToken });
		} catch (error) {
			next(error);
		}
	},
	async getUser(req: Request, res: Response, next: NextFunction) {
		const userID = req.params.id;
		try {
			const result = UserModel.getUser(userID);
			res.status(200).json({ result });
		} catch (error) {
			next(error);
		}
	},
	async deleteUser(req: Request, res: Response, next: NextFunction) {
		const userID = req.params.id;
		try {
			const userData = await UserModel.getUser(userID);
			const logggedInUserID = req.user?.id;
			const loggedInUserRole = req.user?.role;
			if (userData.id !== logggedInUserID || loggedInUserRole !== "admin") {
				throw new Error("NOT_AUTHORIZED");
			}
			UserModel.deleteUser(userID);
			res.status(200).json({ message: "user deleted" });
		} catch (error) {
			next(error);
		}
	},
	async changePassword(req: Request, res: Response, next: NextFunction) {
		const userID = req.params.id;
		const { password } = req.body;
		const saltRounds = 10;
		const passwordHash = await bcrypt.hash(password, saltRounds);

		try {
			const userData = await UserModel.getUser(userID);
			if (userID !== userData.id || userData.role !== "admin") {
				throw new Error("NOT_AUTHORIZED");
			}
			UserModel.changePassword({ password: passwordHash, userId: userID });
			res.status(200).json({ message: "Password changed" });
		} catch (error) {
			next(error);
		}
	},
	async updateRole(req: Request, res: Response, next: NextFunction) {
		const userID = req.params.id;
		const { role } = req.body;
		try {
			const userData = await UserModel.getUser(userID);
			if (userData.role !== "admin") {
				throw new Error("NOT_AUTHORIZED");
			}
			const result = UserModel.updateUserRole({role: role, userId: userID})
			res.status(200).json((await result).rows[0])
		} catch (error) {
			next(error);
		}
	},
};
