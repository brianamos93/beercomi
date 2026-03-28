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
import {
	deletedAtQuerySchema,
	DeletedAtQueryType,
	querySchema,
	QueryType,
	searchQuerySchema,
	SearchQueryType,
} from "../schemas/querySchema";
import validate from "express-zod-safe";
import { idParamSchema } from "../schemas/generalSchemas";
import { activityLogger } from "../utils/middleware/activityLogger";
import { fileValidator } from "../utils/middleware/fileTyper";
import { UserModel } from "../models/user.models";
import { Brewery } from "../defs/brewery.defs";
import { breweryController } from "../controllers/brewery.controller";
const { authenticationHandler } = require("../utils/middleware");
const express = require("express");

const router = Router();

declare module "express-serve-static-core" {
	interface Request {
		user?: {
			id: string;
			role: string;
			display_name: string;
			profile_img_url: string;
			present_location: string;
		};
	}
}
type Params = { id: string };

const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback,
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
		"SELECT id, name, location, date_of_founding, author_id FROM breweries WHERE id = $1 AND deleted_at IS NULL",
		[breweryID],
	);
}

async function softDeletedBreweryLookup(breweryID: string) {
	return await pool.query(
		"SELECT id, name, location, date_of_founding, author_id FROM breweries WHERE id = $1 AND deleted_at IS NOT NULL",
		[breweryID],
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
	validate({ query: searchQuerySchema }),
	breweryController.getBrewerySearch,
);

router.get("/list", express.json(), breweryController.getAllBreweries);

// GET /breweries/:id/beers
router.get(
	"/:id/beers",
	express.json(),
	validate({ params: idParamSchema, query: querySchema }),
	breweryController.getBreweryBeers
);

// GET /breweries/:id
router.get(
	"/:id",
	express.json(),
	validate({ params: idParamSchema }),
	async (req: Request<Params>, res: Response) => {
		const breweryId = req.params.id;

		const brewerycheck = await brewerylookup(breweryId);

		if (brewerycheck.rowCount == 0) {
			return res.status(404).json({ error: "brewery does not exist" });
		}
		try {
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
                WHERE breweries.id = $1 AND breweries.deleted_at IS NULL`,
				[breweryId],
			);
			if (breweryResult.rows.length === 0) {
				return res.status(404).json({ error: "Brewery not found" });
			}
			res.json(breweryResult.rows[0]);
		} catch (error) {
			console.error("Error fetching brewery", error);
			res.status(500).json({ error: "Error fetching brewery" });
		}
	},
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
		getEntityId: (_req, res) => res.locals.createdBrewery,
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
				.webp({ lossless: true })
				.resize(800, 600, { fit: "cover" })
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
				],
			);
			const createdBrewery: Brewery = result.rows[0];
			res.locals.createdBrewery = createdBrewery.id;
			res.status(201).json(createdBrewery);
		} catch (error) {
			console.error("Error adding brewery", error);
			res.status(500).json({ error: "Error adding brewery" });
		}
	},
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
		getEntityId: (_req, res) => res.locals.updatedBrewery,
	}),
	async (req: Request, res: Response) => {
		const breweryID = req.params.id;
		const { name, location, date_of_founding, deleteCoverImage } = req.body;

		const brewerycheck = await brewerylookup(breweryID);

		if (brewerycheck.rowCount == 0) {
			return res.status(404).json({ error: "brewery does not exist" });
		}

		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const breweryuser = await breweryUser(breweryID);

		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}
		const userData = await UserModel.getUser(req.user.id);
		const userRole = userData.role;

		if (req.user.id !== breweryuser.rows[0].author_id && userRole !== "admin") {
			return res.status(400).json({ error: "User not authorized" });
		}

		if (deleteCoverImage === true) {
			const currentBreweryData = await breweryCoverImageLookup(breweryID);
			const currentCoverImage = currentBreweryData.rows[0].cover_image;
			if (!currentCoverImage) {
				res.status(404).json({ error: "No cover image found." });
			}
			const filePath = path.join(__dirname, "..", currentCoverImage);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			const result = await pool.query(
				`UPDATE breweries SET cover_image = NULL WHERE id = $1`,
				[breweryID],
			);
			if (result.rowCount === 0) {
				console.log("No brewery found with that ID");
			}
		}
		let relativeUploadFilePathAndFile;

		if (req.file) {
			const uploadPath = path.join(__dirname, "..", `uploads/`);
			if (!fs.existsSync(uploadPath)) {
				fs.mkdirSync(uploadPath, { recursive: true });
			}
			const ext: string =
				req.file && req.file.originalname
					? path.extname(req.file.originalname)
					: "";
			const newFileName = `CoverImage-${Date.now()}${ext}`;
			const uploadFilePathAndFile = path.join(uploadPath, newFileName);
			await sharp(req.file.buffer)
				.webp({ lossless: true })
				.resize(800, 600, { fit: "cover" })
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
				],
			);
			res.locals.updatedBrewery = breweryID;
			res.status(200).json({ message: "Brewery updated successfully" });
		} catch (error) {
			console.error("PUT /:id error:", error);
			res.status(500).json({ error: "Error" });
		}
	},
);

router.delete(
	"/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_soft_delete",
		entityType: "breweries",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const breweryID = req.params.id;

		const brewerycheck = await brewerylookup(breweryID);
		if (brewerycheck.rowCount === 0) {
			return res.status(404).json({ error: "brewery does not exist" });
		}

		if (!req.user?.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}

		const breweryUserResult = await breweryUser(breweryID);
		const userData = await userIdGet(req.user.id);
		const userRole = userData.rows[0].role;

		if (
			req.user.id !== breweryUserResult.rows[0].author_id &&
			userRole !== "admin"
		) {
			return res.status(400).json({ error: "User not authorized" });
		}

		const client = await pool.connect();
		const deletedAt = new Date();

		try {
			await client.query("BEGIN");

			// delete reviews
			await client.query(
				`UPDATE beer_reviews r
				SET deleted_at = $2
				FROM beers b
				WHERE r.beer_id = b.id
				AND b.brewery_id = $1
				AND r.deleted_at IS NULL`,
				[breweryID, deletedAt],
			);

			// delete beers
			await client.query(
				`UPDATE beers
				SET deleted_at = $2
				WHERE brewery_id = $1
				AND deleted_at IS NULL`,
				[breweryID, deletedAt],
			);

			// delete brewery
			await client.query(
				`UPDATE breweries
				SET deleted_at = $2
				WHERE id = $1
				AND deleted_at IS NULL`,
				[breweryID, deletedAt],
			);

			await client.query("COMMIT");

			res.status(200).json({
				message: "Brewery and related beers/reviews soft deleted",
			});
		} catch (error) {
			await client.query("ROLLBACK");
			console.error("Error deleting brewery", error);
			res.status(500).json({ error: "Error deleting brewery" });
		} finally {
			client.release();
		}
	},
);

// Get a specific soft-deleted brewery with its beers (admin only)
router.get(
	"/deleted/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema, query: querySchema }),
	async (req: Request<Params, unknown, unknown, QueryType>, res: Response) => {
		try {
			if (req.user?.role !== "admin") {
				return res.status(403).json({ error: "User not authorized" });
			}

			const breweryId = req.params.id;
			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;

			// Fetch deleted brewery data
			const breweryResult = await pool.query(
				`SELECT 
                    breweries.id, 
                    breweries.name, 
                    breweries.location, 
                    breweries.date_of_founding,
                    breweries.cover_image, 
                    breweries.date_created, 
                    breweries.date_updated,
                    breweries.deleted_at,
                    brewery_authors.display_name AS author_name,
                    breweries.author_id
                FROM breweries
                LEFT JOIN users AS brewery_authors 
                    ON breweries.author_id = brewery_authors.id
                WHERE breweries.id = $1 AND breweries.deleted_at IS NOT NULL
                `,
				[breweryId],
			);

			if (breweryResult.rows.length === 0) {
				return res.status(404).json({ error: "Deleted brewery not found" });
			}

			const brewery = breweryResult.rows[0];

			// Fetch beers for the brewery
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
				[breweryId, limit, offset],
			);

			// Count total beers
			const countResult = await pool.query(
				`SELECT COUNT(*) FROM beers WHERE brewery_id = $1`,
				[breweryId],
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
			console.error("Error fetching deleted brewery", error);
			res.status(500).json({ error: "Error fetching deleted brewery" });
		}
	},
);

router.put(
	"/admin/undo/delete/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_undo_soft_delete",
		entityType: "breweries",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const breweryID = req.params.id;

		const brewerycheck = await softDeletedBreweryLookup(breweryID);
		if (brewerycheck.rowCount === 0) {
			return res
				.status(404)
				.json({ error: "brewery does not exist or is not soft deleted" });
		}

		if (!req.user?.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}

		const breweryUserResult = await breweryUser(breweryID);
		const userData = await userIdGet(req.user.id);
		const userRole = userData.rows[0].role;

		if (
			req.user.id !== breweryUserResult.rows[0].author_id &&
			userRole !== "admin"
		) {
			return res.status(400).json({ error: "User not authorized" });
		}

		const client = await pool.connect();

		try {
			await client.query("BEGIN");

			// Get the deleted_at timestamp from the brewery
			const breweryResult = await client.query(
				`SELECT deleted_at FROM breweries WHERE id = $1`,
				[breweryID],
			);

			const deletedAt = breweryResult.rows[0].deleted_at;

			// restore reviews deleted in same transaction
			await client.query(
				`UPDATE beer_reviews r
				SET deleted_at = NULL
				FROM beers b
				WHERE r.beer_id = b.id
				AND b.brewery_id = $1
				AND r.deleted_at = $2`,
				[breweryID, deletedAt],
			);

			// restore beers deleted in same transaction
			await client.query(
				`UPDATE beers
				SET deleted_at = NULL
				WHERE brewery_id = $1
				AND deleted_at = $2`,
				[breweryID, deletedAt],
			);

			// restore brewery
			await client.query(
				`UPDATE breweries
				SET deleted_at = NULL
				WHERE id = $1`,
				[breweryID],
			);

			await client.query("COMMIT");

			res.status(200).json({
				message: "Brewery and related beers/reviews restored",
			});
		} catch (error) {
			await client.query("ROLLBACK");
			console.error("Error undoing delete brewery", error);
			res.status(500).json({ error: "Error undoing delete brewery" });
		} finally {
			client.release();
		}
	},
);

// Hard delete brewery (admin only)
router.delete(
	"/admin/hard-delete/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_hard_deleted",
		entityType: "breweries",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const breweryID = req.params.id;

		if (req.user?.role !== "admin") {
			return res.status(403).json({ error: "User not authorized" });
		}

		const client = await pool.connect();
		const filesToDelete: string[] = [];

		try {
			await client.query("BEGIN");

			const breweryResult = await client.query(
				`SELECT cover_image FROM breweries WHERE id = $1`,
				[breweryID],
			);

			if (breweryResult.rowCount === 0) {
				await client.query("ROLLBACK");
				return res.status(404).json({ error: "Brewery not found" });
			}

			// brewery cover image
			if (breweryResult.rows[0].cover_image) {
				filesToDelete.push(
					path.join(__dirname, "..", breweryResult.rows[0].cover_image),
				);
			}

			// beer cover images
			const beerImages = await client.query(
				`SELECT cover_image FROM beers WHERE brewery_id = $1`,
				[breweryID],
			);

			for (const beer of beerImages.rows) {
				if (beer.cover_image) {
					filesToDelete.push(path.join(__dirname, "..", beer.cover_image));
				}
			}

			// review photos
			const reviewPhotos = await client.query(
				`
				SELECT rp.photo_url
				FROM review_photos rp
				INNER JOIN beer_reviews br
					ON rp.review_id = br.id
				INNER JOIN beers b
					ON br.beer_id = b.id
				WHERE b.brewery_id = $1
				`,
				[breweryID],
			);

			for (const photo of reviewPhotos.rows) {
				if (photo.photo_url) {
					filesToDelete.push(path.join(__dirname, "..", photo.photo_url));
				}
			}

			// delete review photos
			await client.query(
				`DELETE FROM review_photos
				 WHERE review_id IN (
					 SELECT id FROM beer_reviews
					 WHERE beer_id IN (
						 SELECT id FROM beers WHERE brewery_id = $1
					 )
				 )`,
				[breweryID],
			);

			// delete reviews
			await client.query(
				`DELETE FROM beer_reviews
				 WHERE beer_id IN (
					 SELECT id FROM beers WHERE brewery_id = $1
				 )`,
				[breweryID],
			);

			// delete beers
			await client.query(`DELETE FROM beers WHERE brewery_id = $1`, [
				breweryID,
			]);

			// delete brewery
			await client.query(`DELETE FROM breweries WHERE id = $1`, [breweryID]);

			await client.query("COMMIT");

			// delete files from disk
			for (const filePath of filesToDelete) {
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch (fileErr) {
					console.error("File deletion failed:", filePath, fileErr);
				}
			}

			res.status(200).json({
				message:
					"Brewery, beers, reviews, and all associated images permanently deleted",
			});
		} catch (error) {
			await client.query("ROLLBACK");
			console.error("Error hard deleting brewery", error);
			res.status(500).json({
				error: "Error hard deleting brewery",
			});
		} finally {
			client.release();
		}
	},
);

// Get all / deleted
router.get(
	"/admin/view",
	authenticationHandler,
	express.json(),
	validate({ query: deletedAtQuerySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, DeletedAtQueryType>,
		res: Response,
	) => {
		try {
			if (req.user?.role !== "admin") {
				return res.status(403).json({ error: "User not authorized" });
			}

			const limit = Number(req.query.limit) || 10;
			const offset = Number(req.query.offset) || 0;
			const deletedFilter = req.query.deleted ?? "all";

			let whereClause = "";
			if (deletedFilter === "true") {
				whereClause = "WHERE breweries.deleted_at IS NOT NULL";
			} else if (deletedFilter === "false") {
				whereClause = "WHERE breweries.deleted_at IS NULL";
			}

			const mainQuery = `
					SELECT 
						breweries.id,
						breweries.name,
						breweries.location,
						breweries.date_of_founding,
						breweries.date_created,
						breweries.date_updated,
						breweries.deleted_at,
						breweries.author_id,
						brewery_authors.display_name AS author_name
					FROM breweries
					LEFT JOIN users AS brewery_authors 
						ON breweries.author_id = brewery_authors.id
					${whereClause}
					ORDER BY breweries.deleted_at ASC
					LIMIT $1 OFFSET $2
					`;

			const countQuery = `
					SELECT COUNT(*) 
					FROM breweries
					${whereClause}
					`;

			const [breweriesResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const breweries: Brewery[] = breweriesResult.rows;
			const totalItems = parseInt(countResult.rows[0].count);

			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: breweries,
			});
		} catch (error) {
			console.error("Error fetching deleted breweries", error);
			res.status(500).json({ error: "Error fetching deleted breweries" });
		}
	},
);

export default router;
