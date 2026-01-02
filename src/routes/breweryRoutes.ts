import { Router, Request, Response } from "express";
import pool from "../utils/config";
import { decodeToken } from "../utils/userlib";
import multer from "multer";
import fs from "fs";
import path from "path";
import { FileFilterCallback } from "multer";
import sharp from "sharp";
import { userIdGet } from "./userRoutes";
import {
	BrewerySchemaBase,
	EditBrewerySchema,
} from "../schemas/brewerySchemas";
import { querySchema, QueryType } from "../schemas/querySchema";
import validate from "express-zod-safe";
import { idParamSchema } from "../schemas/generalSchemas";
import { activityLogger } from "../utils/middleware/activityLogger";
import { fileValidator } from "../utils/middleware/fileTyper";
const { authenticationHandler } = require("../utils/middleware");
const express = require("express");

const router = Router();

declare module "express-serve-static-core" {
	interface Request {
		user?: { id: string; role: string };
	}
}
type Params = { id: string };

interface Brewery {
	id: number;
	name: string;
	location: string;
	date_of_founding: string;
	date_created: Date;
	date_updated: Date;
	author_id: string;
	owner: string;
}

const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback
) => {
	// Reject empty files (size 0 or name 'undefined')
	if (
		!file.originalname ||
		file.size === 0 ||
		file.originalname === "undefined"
	) {
		// Skip this file, treat as no file uploaded
		return cb(null, false);
	}
	const allowedTypes = ["image/jpeg", "image/png"];
	if (allowedTypes.includes(file.mimetype)) cb(null, true);
	else cb(new Error("Only .jpeg and .png files are allowed"));
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });

async function brewerylookup(breweryID: string) {
	return await pool.query(
		"SELECT id, name, location, date_of_founding, author_id FROM breweries WHERE id = $1",
		[breweryID]
	);
}

async function breweryUser(breweryID: string) {
	return await pool.query("SELECT author_id FROM breweries WHERE id = $1", [
		breweryID,
	]);
}

async function breweryCoverImageLookup(breweryID: string) {
	return await pool.query("SELECT cover_image FROM breweries WHERE id = $1", [
		breweryID,
	]);
}

router.get(
	"/",
	express.json(),
	validate({ query: querySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, QueryType>,
		res: Response
	) => {
		try {
			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;

			const mainQuery = `
			SELECT 
    			breweries.id,
   				breweries.name,
				breweries.location,
				breweries.date_of_founding,
				breweries.date_created,
				breweries.date_updated,
				breweries.author_id,
				brewery_authors.display_name AS author_name
				FROM breweries
				LEFT JOIN users AS brewery_authors 
					ON breweries.author_id = brewery_authors.id
				ORDER BY breweries.date_updated DESC
				LIMIT $1 OFFSET $2
			`;

			const countQuery = `SELECT COUNT(*) FROM breweries`;
			const [breweriesResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const brewereies: Brewery[] = breweriesResult.rows;

			const totalItems = parseInt(countResult.rows[0].count);
			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: brewereies,
			});
		} catch (error) {
			console.error("Error fetching breweries", error);
			res.status(500).json({ error: "Error fetching breweries" });
		}
	}
);

router.get("/list", express.json(), async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT id FROM breweries");
		const breweries: Brewery[] = result.rows;
		res.json(breweries);
	} catch (error) {
		console.error("Error fetching breweries", error);
		res.status(500).json({ error: "Error fetching breweries" });
	}
});

router.get(
	"/:id",
	express.json(),
	validate({ params: idParamSchema, query: querySchema }),
	async (req: Request<Params, unknown, unknown, QueryType>, res: Response) => {
		const breweryId = req.params.id;
		const limit = req.query.limit || 10;
		const offset = req.query.offset || 0;

		try {
			// -------- 1. Fetch brewery data (without beers)
			const breweryResult = await pool.query(
				`SELECT 
					breweries.id, 
					breweries.name, 
					breweries.location, 
					breweries.date_of_founding,
					breweries.cover_image, 
					breweries.date_created, 
					breweries.date_updated, 
					brewery_authors.display_name AS author_name,
					breweries.author_id
				FROM breweries
				LEFT JOIN users AS brewery_authors 
					ON breweries.author_id = brewery_authors.id
				WHERE breweries.id = $1
				`,
				[breweryId]
			);

			if (breweryResult.rows.length === 0) {
				return res.status(404).json({ error: "Brewery not found" });
			}

			const brewery = breweryResult.rows[0];

			// -------- 2. Fetch paginated beers
			const beersResult = await pool.query(
				`SELECT 
					beers.id,
					beers.name,
					beers.style,
					beers.ibu,
					beers.abv,
					beers.color,
					beers.description,
					beers.cover_image,
					beers.date_created,
					beers.date_updated,
					beers.author_id,
					beer_authors.display_name AS author_name
				FROM beers
				LEFT JOIN users AS beer_authors ON beers.author_id = beer_authors.id
				WHERE beers.brewery_id = $1
				ORDER BY beers.date_created DESC
				LIMIT $2 OFFSET $3
				`,
				[breweryId, limit, offset]
			);

			// -------- 3. Count total beers for frontend pagination UI
			const countResult = await pool.query(
				`SELECT COUNT(*) FROM beers WHERE brewery_id = $1`,
				[breweryId]
			);

			const totalBeers = Number(countResult.rows[0].count);

			res.json({
				...brewery,
				beers: beersResult.rows,
				pagination: {
					total: totalBeers,
					limit,
					offset,
				},
			});
		} catch (error) {
			console.error("Error fetching brewery", error);
			res.status(500).json({ error: "Error fetching brewery" });
		}
	}
);

router.post(
	"/",
	authenticationHandler,
	upload.single("cover_image"),
	fileValidator,
	validate({ body: BrewerySchemaBase }),
	activityLogger({
		action: "brewery_post",
		entityType: "breweries",
		getEntityId: (_req, res) => res.locals.deletedReview,
	}),
	async (req: Request, res: Response) => {
		const { name, location, date_of_founding } = req.body;

		let newFileName = null;
		let relativeUploadFilePathAndFile = null;

		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}
		const user = await pool.query("SELECT * FROM users WHERE id = $1", [
			req.user.id,
		]);
		//Process uploaded file
		if (req.file) {
			const uploadPath = path.join(__dirname, "..", `uploads/`);
			if (!fs.existsSync(uploadPath)) {
				fs.mkdirSync(uploadPath, { recursive: true });
			}
			const ext: string =
				req.file && req.file.originalname
					? path.extname(req.file.originalname)
					: "";
			newFileName = `CoverImage-${Date.now()}${ext}`;
			const uploadFilePathAndFile = path.join(uploadPath, newFileName);
			await sharp(req.file.buffer)
				.resize(200, 200)
				.toFile(uploadFilePathAndFile);
			relativeUploadFilePathAndFile = `/uploads/${newFileName}`;
		}
		try {
			const result = await pool.query(
				"INSERT INTO breweries (name, location, date_of_founding, author_id, cover_image) VALUES ($1, $2, $3, $4, $5) RETURNING *",
				[
					name,
					location,
					date_of_founding,
					user.rows[0].id,
					relativeUploadFilePathAndFile,
				]
			);
			const createdBrewery: Brewery = result.rows[0];
			res.locals.createdBrewery = createdBrewery.id;
			res.status(201).json(createdBrewery);
		} catch (error) {
			console.error("Error adding brewery", error);
			res.status(500).json({ error: "Error adding brewery" });
		}
	}
);

router.put(
	"/:id",
	authenticationHandler,
	upload.single("cover_image"),
	fileValidator,
	validate({ body: EditBrewerySchema, params: idParamSchema }),
	activityLogger({
		action: "brewery_edited",
		entityType: "brewries",
		getEntityId: (_req, res) => res.locals.deletedReview,
	}),
	async (req: Request, res: Response) => {
		const breweryID = req.params.id;
		const { name, location, date_of_founding, deleteCoverImage } = req.body;

		const brewerycheck = await brewerylookup(breweryID);

		if (brewerycheck.rowCount == 0) {
			return res.status(401).json({ error: "brewery does not exist" });
		}

		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const breweryuser = await breweryUser(breweryID);

		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}
		const userData = await userIdGet(req.user.id);
		const userRole = userData.rows[0].role;

		if (req.user.id !== breweryuser.rows[0].author_id && userRole !== "admin") {
			return res.status(400).json({ error: "User not authorized" });
		}

		if (deleteCoverImage === true) {
			const currentCoverImage = brewerycheck.rows[0].cover_image;
			if (!currentCoverImage) {
				res.status(404).json({ error: "No cover image found." });
			}
			const filePath = path.join(__dirname, "..", currentCoverImage);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			const result = await pool.query(
				`UPDATE breweries SET cover_image = NULL WHERE id = $1`,
				[breweryID]
			);
			if (result.rowCount === 0) {
				console.log("No brewery found with that ID");
			}
		}
		let relativeUploadFilePathAndFile;

		if (req.file) {
			const uploadPath = path.join(__dirname, "..", `uploads/`);
			if (!fs.existsSync(uploadPath)) {
				fs.mkdirSync(uploadPath);
			}
			const ext: string =
				req.file && req.file.originalname
					? path.extname(req.file.originalname)
					: "";
			const newFileName = `-CoverImage-${Date.now()}${ext}`;
			const uploadFilePathAndFile = path.join(uploadPath, newFileName);
			await sharp(req.file.buffer)
				.resize(200, 200)
				.toFile(uploadFilePathAndFile);
			relativeUploadFilePathAndFile = `/uploads/${newFileName}`;
		}

		try {
			await pool.query(
				"UPDATE breweries SET name = $1, location = $2, date_of_founding = $3, cover_image = $4 WHERE id = $5",
				[
					name,
					location,
					date_of_founding,
					relativeUploadFilePathAndFile,
					breweryID,
				]
			);
			res.locals.deletedReview = breweryID;
			res.status(200).json({ message: "Brewery updated successfully" });
		} catch (error) {
			console.error("PUT /:id error:", error);
			res.status(500).json({ error: "Error" });
		}
	}
);

router.delete(
	"/:id",
	express.json(),
	authenticationHandler,
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_delete",
		entityType: "breweries",
		getEntityId: (_req, res) => res.locals.deletedReview,
	}),
	async (req: Request, res: Response) => {
		const breweryID = req.params.id;
		const brewerycheck = await brewerylookup(breweryID);
		if (brewerycheck.rowCount == 0) {
			return res.status(401).json({ error: "brewery does not exist" });
		}
		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}
		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}
		const breweryUserResult = await breweryUser(breweryID);
		const userData = await userIdGet(req.user.id);
		const userRole = userData.rows[0].role;

		if (
			req.user.id !== breweryUserResult.rows[0].authorid &&
			userRole !== "admin"
		) {
			return res.status(400).json({ error: "User not authorized" });
		}

		const breweryCoverImageRes = await breweryCoverImageLookup(breweryID);
		const coverImagePathAndFile = breweryCoverImageRes.rows[0].cover_image;
		if (fs.existsSync(coverImagePathAndFile)) {
			fs.unlinkSync(coverImagePathAndFile);
		}

		try {
			await pool.query("DELETE FROM breweries WHERE id = $1", [breweryID]);
			res.locals.deletedReview = breweryID;
			res.sendStatus(200);
		} catch (error) {
			console.error("Error deleting brewery", error);
			res.status(500).json({ error: "Error deleting brewery" });
		}
	}
);

export default router;
