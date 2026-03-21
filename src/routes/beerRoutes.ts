import { Router, Request, Response } from "express";
import pool from "../utils/config";
import { tokenUser, decodeToken } from "../utils/userlib";
import multer from "multer";
import fs from "fs";
import path from "path";
import { FileFilterCallback } from "multer";
import sharp from "sharp";
import { BeerSchemaBase, EditBeerSchema } from "../schemas/beerSchemas";
import { CreateReviewSchema, EditReviewSchema } from "../schemas/reviewSchemas";
import {
	deletedAtQuerySchema,
	DeletedAtQueryType,
	querySchema,
	QueryType,
} from "../schemas/querySchema";
const { authenticationHandler } = require("../utils/middleware");
import express from "express";
import validate from "express-zod-safe";
import { idParamSchema } from "../schemas/generalSchemas";
import { activityLogger } from "../utils/middleware/activityLogger";
import { fileValidator } from "../utils/middleware/fileTyper";

const router = Router();

interface Beer {
	id: string;
	name: string;
	brewery: string;
	description: string;
	style: string;
	ibu: number;
	abv: number;
	color: string;
	author_id: string;
	cover_image: string;
	date_created: Date;
	date_updated: Date;
}

interface Review {
	id: string;
	author_id: string;
	beerid: string;
	review: string;
	rating: number;
}

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

const upload = multer({
	storage: multer.memoryStorage(),
	fileFilter,
	limits: { fileSize: 1_000_000 },
});

export async function beerlookup(beerID: string) {
	return await pool.query(
		"SELECT id, name, brewery_id, description, ibu, abv, color, author_id, style, cover_image FROM beers WHERE id = $1 AND deleted_at IS NULL",
		[beerID],
	);
}

export async function deletedBeerLookup(beerID: string) {
	return await pool.query(
		"SELECT id, name, brewery_id, description, ibu, abv, color, author_id, style, cover_image FROM beers WHERE id = $1 AND deleted_at IS NOT NULL",
		[beerID],
	);
}

async function beerUser(beerID: string) {
	return await pool.query("SELECT author_id FROM beers WHERE id = $1", [
		beerID,
	]);
}

async function reviewLookup(reviewID: string) {
	return await pool.query(
		"SELECT id FROM beer_reviews WHERE id = $1 AND deleted_at IS NULL",
		[reviewID],
	);
}

async function softDeletedReviewLookup(reviewID: string) {
	return await pool.query(
		"SELECT id FROM beer_reviews WHERE id = $1 AND deleted_at IS NOT NULL",
		[reviewID],
	);
}

async function reviewUser(reviewID: string) {
	return await pool.query("SELECT author_id FROM beer_reviews WHERE id = $1", [
		reviewID,
	]);
}

async function userBeerLookup(authorID: string, beerID: string) {
	return await pool.query(
		"SELECT id FROM beer_reviews WHERE author_id = $1 AND beer_id = $2",
		[authorID, beerID],
	);
}

export async function breweryLookup(breweryID: string) {
	return await pool.query(
		"SELECT name, id, location, date_of_founding, date_created, date_updated, author_id FROM breweries WHERE id = $1",
		[breweryID],
	);
}

async function beerCoverImageLookup(beerId: string) {
	return await pool.query("SELECT cover_image FROM beers WHERE id = $1", [
		beerId,
	]);
}

async function reviewPhotoLookup(reviewId: string) {
	return await pool.query(
		"SELECT user_id, photo_url, position FROM review_photos WHERE review_id = $1",
		[reviewId],
	);
}

async function photoLookup(photoId: string) {
	return await pool.query(
		"SELECT user_id, photo_url FROM review_photos WHERE id = $1",
		[photoId],
	);
}

router.get(
	"/",
	express.json(),
	validate({ query: querySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, QueryType>,
		res: Response,
	) => {
		try {
			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;
			const mainQuery = `
				SELECT 
					beers.id, 
					beers.name, 
					beers.brewery_id, 
					breweries.name AS brewery_name, 
					beers.description, 
					beers.style, 
					beers.ibu, 
					beers.abv, 
					beers.color, 
					beers.cover_image, 
					beers.date_updated, 
					beers.author_id,
					beer_authors.display_name AS author_name,
					beer_authors.id AS author_id,
					beers.date_created,

					COALESCE(ratings.avg_rating, 0) AS avg_rating,
					COALESCE(ratings.review_count, 0) AS review_count

				FROM beers

				LEFT JOIN users AS beer_authors 
					ON beers.author_id = beer_authors.id

				LEFT JOIN breweries 
					ON beers.brewery_id = breweries.id 

				LEFT JOIN (
					SELECT 
						beer_id,
						ROUND(AVG(rating), 2) AS avg_rating,
						COUNT(*) AS review_count
					FROM beer_reviews
					GROUP BY beer_id
				) ratings 
					ON beers.id = ratings.beer_id

				WHERE beers.deleted_at IS NULL

				ORDER BY beers.date_updated DESC

				LIMIT $1 OFFSET $2
				`;
			const countQuery = `SELECT COUNT(*) FROM beers WHERE deleted_at IS NULL`;

			const [beersResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const totalItems = parseInt(countResult.rows[0].count);

			const beers: Beer[] = beersResult.rows;
			const modifiedBeers = beers.map((beer) => {
				return {
					...beer,
					abv: beer.abv / 10,
				};
			});
			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: modifiedBeers,
			});
		} catch (error) {
			console.error("Error fetching beers", error);
			res.status(500).json({ error: "Error fetching beers" });
		}
	},
);

router.get("/list", express.json(), async (req: Request, res: Response) => {
	try {
		const result = await pool.query(
			"SELECT id FROM beers WHERE deleted_at IS NULL",
		);
		const beers: Beer[] = result.rows;
		res.json(beers);
	} catch (error) {
		console.error("Error fetching beers", error);
		res.status(500).json({ error: "Error fetching beers" });
	}
});

router.get(
    "/:id/reviews",
    express.json(),
    validate({ params: idParamSchema, query: querySchema }),
    async (req: Request<any, any, any, QueryType>, res: Response) => {
        const beerId = req.params.id;
        const limit = Number(req.query.limit) || 10;
        const offset = Number(req.query.offset) || 0;

		const beercheck = await beerlookup(beerId);
		if (beercheck.rowCount == 0) {
			return res
				.status(404)
				.json({ error: "beer does not exist or is already soft deleted" });
		}
        try {
            const reviewsResult = await pool.query(
                `SELECT
                beer_reviews.id,
                beer_reviews.rating,
                beer_reviews.review,
                beer_reviews.author_id,
                review_authors.display_name AS author_name,
                beer_reviews.date_updated,
                beer_reviews.date_created,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', review_photos.id,
                                'photo_url', review_photos.photo_url,
                                'date_updated', review_photos.date_updated,
                                'position', review_photos.position
                            )
                            ORDER BY review_photos.date_created DESC
                        )
                        FROM review_photos
                        WHERE review_photos.review_id = beer_reviews.id AND review_photos.deleted_at IS NULL
                    ),
                    '[]'
                ) AS photos
                FROM beer_reviews
                LEFT JOIN users AS review_authors 
                ON beer_reviews.author_id = review_authors.id
                WHERE beer_reviews.beer_id = $1 AND beer_reviews.deleted_at IS NULL
                ORDER BY beer_reviews.date_created DESC
                LIMIT $2 OFFSET $3`,
                [beerId, limit, offset],
            );

            const totalResult = await pool.query(
                `SELECT COUNT(*) FROM beer_reviews WHERE beer_id = $1 AND deleted_at IS NULL`,
                [beerId],
            );
            const totalReviews = Number(totalResult.rows[0].count);

            res.json({
                reviews: reviewsResult.rows,
                pagination: {
                    total: totalReviews,
                    limit,
                    offset,
                },
            });
        } catch (error) {
            console.error("Error fetching reviews", error);
            res.status(500).json({ error: "Error fetching reviews" });
        }
    },
);

router.get(
    "/:id",
    express.json(),
    validate({ params: idParamSchema }),
    async (req: Request, res: Response) => {
        const beerId = req.params.id;
        try {
            const beerResult = await pool.query(
                `SELECT
                beers.id,
                beers.name,
                beers.brewery_id,
                breweries.name AS brewery_name,
                beers.description,
                beers.style,
                beers.ibu,
                beers.abv,
                beers.color,
                beers.author_id,
                beer_authors.display_name AS author_name,
                beer_authors.id AS author_id,
                beers.date_updated,
                beers.date_created,
                beers.cover_image,
                COALESCE(ratings.avg_rating, 0) AS avg_rating,
                COALESCE(ratings.review_count, 0) AS review_count
                FROM beers
                LEFT JOIN breweries 
                ON beers.brewery_id = breweries.id
                LEFT JOIN users AS beer_authors 
                ON beers.author_id = beer_authors.id
                LEFT JOIN (
                    SELECT
                        beer_id,
                        ROUND(AVG(rating), 2) AS avg_rating,
                        COUNT(*) AS review_count
                    FROM beer_reviews
                    WHERE deleted_at IS NULL
                    GROUP BY beer_id
                    ) ratings
                    ON beers.id = ratings.beer_id
                WHERE beers.id = $1
                AND beers.deleted_at IS NULL`,
                [beerId],
            );

            if (beerResult.rows.length === 0) {
                return res.status(404).json({ error: "Beer not found" });
            }

            const beer = beerResult.rows[0];
            beer.abv = beer.abv / 10;

            res.json(beer);
        } catch (error) {
            console.error("Error fetching beer", error);
            res.status(500).json({ error: "Error fetching beer" });
        }
    },
);

router.post(
	"/",
	authenticationHandler,
	upload.single("cover_image"),
	fileValidator,
	validate({ body: BeerSchemaBase }),
	activityLogger({
		action: "beer_created",
		entityType: "beers",
		getEntityId: (_req, res) => res.locals.createdBeerId,
	}),
	async (req: Request, res: Response) => {
		for (const key in req.body) {
			if (typeof req.body[key] === "string") {
				req.body[key] = req.body[key].trim();
			}
		}
		const { name, brewery_id, description, style, ibu, abv, color } = req.body;
		const trimmedBrewery_id = brewery_id.trim();
		const brewery = await breweryLookup(trimmedBrewery_id);
		if (brewery.rowCount === 0) {
			return res.status(401).json({ Errror: "Brewery Not Found" });
		}
		let newFileName = null;
		let relativeUploadFilePathAndFile = null;

		if (!req.user || !req.user.id) {
			return res.status(401).json({ error: "Unauthorized: user not found" });
		}

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
			const user = await pool.query("SELECT * FROM users WHERE id = $1", [
				req.user.id,
			]);
			if (!user) {
				return res.status(401).json({ error: "User not found" });
			}

			const formatedIbu = Number(ibu);
			const formatedAbv = Number(abv * 10);
			const result = await pool.query(
				"INSERT INTO beers (name, brewery_id, description, style, ibu, abv, color, author_id, cover_image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
				[
					name,
					trimmedBrewery_id,
					description,
					style,
					formatedIbu,
					formatedAbv,
					color,
					user.rows[0].id,
					relativeUploadFilePathAndFile,
				],
			);
			const createdBeer: Beer = result.rows[0];
			res.locals.createdBeerId = result.rows[0].id;
			res.status(201).json(createdBeer);
		} catch (error) {
			console.error("Error adding beer", error);
			res.status(500).json({ error: "Error adding beer" });
		}
	},
);

router.delete(
	"/:id",
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "beer_soft_deleted",
		entityType: "beers",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const beerID = req.params.id;
		const beercheck = await beerlookup(beerID);
		if (beercheck.rowCount == 0) {
			return res
				.status(404)
				.json({ error: "beer does not exist or is already soft deleted" });
		}
		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const user = await tokenUser(decodedToken);
		if (
			user.rows[0].role !== "admin" &&
			user.rows[0].id !== beercheck.rows[0].author_id
		) {
			return res.status(403).json({ error: "User not authorized" });
		}

		try {
			const result = await pool.query(
				"UPDATE beers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
				[beerID],
			);
			res.status(200).json(result);
		} catch (error) {
			console.error("Error deleting beer", error);
			res.status(500).json({ error: "Error deleting beer" });
		}
	},
);

router.post(
	"/admin/undo/delete/:id",
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "beer_soft_deleted_undo",
		entityType: "beers",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const beerID = req.params.id;
		const beercheck = await deletedBeerLookup(beerID);
		if (beercheck.rowCount == 0) {
			return res.status(401).json({ error: "beer not soft deleted" });
		}
		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const user = await tokenUser(decodedToken);
		if (
			user.rows[0].role !== "admin" &&
			user.rows[0].id !== beercheck.rows[0].author_id
		) {
			return res.status(400).json({ error: "User not authorized" });
		}

		try {
			const results = await pool.query(
				"UPDATE beers SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL",
				[beerID],
			);
			res.status(200).json(results);
		} catch (error) {
			console.error("Error restoring beer", error);
			res.status(500).json({ error: "Error restoring beer" });
		}
	},
);

router.put(
	"/:id",
	authenticationHandler,
	upload.single("cover_image"),
	fileValidator,
	(req, res, next) => {
		console.log("req.body:", req.body);
		console.log("File:", req.file);
		next();
	},
	validate({ body: EditBeerSchema, params: idParamSchema }),
	activityLogger({
		action: "beer_edited",
		entityType: "beers",
		getEntityId: (_req, res) => res.locals.updatedBeerId,
	}),
	async (req: Request, res: Response) => {
		const beerID = req.params.id;
		const {
			name,
			brewery_id,
			description,
			style,
			ibu,
			abv,
			color,
			deleteCoverImage,
		} = req.body;
		const beercheck = await beerlookup(beerID);
		const userId = req?.user?.id;
		console.log(deleteCoverImage, typeof deleteCoverImage);

		if (beercheck.rowCount == 0) {
			return res.status(404).json({ error: "beer does not exist" });
		}

		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const beeruser = await beerUser(beerID);

		if (userId !== beeruser.rows[0].author_id) {
			return res.status(400).json({ error: "User not authorized" });
		}
		let newFileName;

		const currentBeer = beercheck.rows[0];

		if (deleteCoverImage === 'true' && currentBeer.cover_image) {
			const currentCoverImage = currentBeer.cover_image;
			const filePath = path.join(__dirname, "..", currentCoverImage);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			const result = await pool.query(
				`UPDATE beers SET cover_image = NULL WHERE id = $1`,
				[beerID],
			);
			if (result.rowCount === 0) {
				console.log("No beer found with that ID");
			}
		}
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
			const relativeUploadFilePathAndFile = `/uploads/${newFileName}`;
			await pool.query(`UPDATE beers SET cover_image = $1 WHERE id = $2`, [
				relativeUploadFilePathAndFile,
				beerID,
			]);
		}
		const formatedAbv = Number(abv * 10);

		try {
			await pool.query(
				`UPDATE beers SET name = $1, brewery_id = $2, description = $3, style = $4, ibu = $5, abv = $6, color = $7 WHERE id = $8`,
				[name, brewery_id, description, style, ibu, formatedAbv, color, beerID],
			);
			res.locals.updatedBeerId = beerID;
			res.status(200).json({ message: "Beer updated successfully" });
		} catch (error) {
			console.log(error);
			res.status(500).json({ error: "Error updating beer" });
		}
	},
);

router.get(
	"/review/:id",
	express.json(),
	validate({ params: idParamSchema }),
	async (req: Request, res: Response) => {
		const reviewId = req.params.id;
		try {
			const result = await pool.query(
				`SELECT
            beer_reviews.id,
            beer_reviews.author_id,
            beer_reviews.beer_id,
            beer_reviews.review,
            beer_reviews.rating,
            beer_reviews.date_created,
            beer_reviews.date_updated,
            users.display_name AS author_name,
            beers.name AS beer_name,
            breweries.name AS brewery_name,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', review_photos.id,
                        'photo_url', review_photos.photo_url,
                        'date_updated', review_photos.date_updated,
                        'position', review_photos.position
                    )
                ) FILTER (WHERE review_photos.id IS NOT NULL AND review_photos.deleted_at IS NULL), '[]'
            ) AS photos
        FROM beer_reviews
        LEFT JOIN users ON beer_reviews.author_id = users.id
        LEFT JOIN beers ON beer_reviews.beer_id = beers.id
        LEFT JOIN breweries ON beers.brewery_id = breweries.id
        LEFT JOIN review_photos ON beer_reviews.id = review_photos.review_id
        WHERE beer_reviews.id = $1 AND beers.deleted_at IS NULL AND beer_reviews.deleted_at IS NULL
        GROUP BY
            beer_reviews.id,
            beer_reviews.author_id,
            beer_reviews.beer_id,
            beer_reviews.review,
            beer_reviews.rating,
            beer_reviews.date_created,
            beer_reviews.date_updated,
            users.display_name,
            beers.name,
            breweries.name;
            `,
				[reviewId],
			);
			if (result.rowCount === 0) {
				return res.status(404).json({ error: "Review not found" });
			}
			const review: Review = result.rows[0];
			res.json(review);
		} catch (error) {
			console.error("Error fetching review", error);
			res.status(500).json({ error: "Error fetching review" });
		}
	},
);
//get all reviews
router.get(
	"/review/",
	express.json(),
	validate({ query: querySchema }),
	async (req: Request<any, any, any, QueryType>, res: Response) => {
		const limit = Number(req.query.limit) || 10;
		const offset = Number(req.query.offset) || 0;

		try {
			const result = await pool.query(
				`SELECT
            beer_reviews.id,
            beer_reviews.author_id,
            beer_reviews.beer_id,
            beer_reviews.review,
            beer_reviews.rating,
            beer_reviews.date_created,
            beer_reviews.date_updated,
            users.display_name AS author_name,
            beers.name AS beer_name,
            breweries.name AS brewery_name,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', review_photos.id,
                        'photo_url', review_photos.photo_url,
                        'date_updated', review_photos.date_updated,
                        'position', review_photos.position
                    )
                ) FILTER (WHERE review_photos.id IS NOT NULL AND review_photos.deleted_at IS NULL), '[]'
            ) AS photos
        FROM beer_reviews
        LEFT JOIN users ON beer_reviews.author_id = users.id
        LEFT JOIN beers ON beer_reviews.beer_id = beers.id
        LEFT JOIN breweries ON beers.brewery_id = breweries.id
        LEFT JOIN review_photos ON beer_reviews.id = review_photos.review_id
        WHERE beers.deleted_at IS NULL AND beer_reviews.deleted_at IS NULL
        GROUP BY
            beer_reviews.id,
            users.display_name,
            beers.name,
            breweries.name
        ORDER BY beer_reviews.date_created DESC
        LIMIT $1 OFFSET $2
        `,
				[limit, offset],
			);

			if (result.rowCount === 0) {
				return res.status(404).json({ error: "Review not found" });
			}

			const reviews: Review[] = result.rows;
			res.json(reviews);
		} catch (error) {
			console.error("Error fetching reviews", error);
			res.status(500).json({ error: "Error fetching reviews" });
		}
	},
);

//create new review
router.post(
	"/review/",
	authenticationHandler,
	upload.array("photos", 4),
	fileValidator,
	validate({ body: CreateReviewSchema }),
	activityLogger({
		action: "review_created",
		entityType: "reviews",
		getEntityId: (_req, res) => res.locals.createdReview,
	}),
	async (req: Request, res: Response) => {
		const client = await pool.connect();
		const { rating, review, beer_id } = req.body;
		const decodedToken = decodeToken(req);

		if (!decodedToken.id || !req.user || !req.user.id) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		const userId = req.user.id;
		const reviewCheck = await userBeerLookup(userId, beer_id);
		if (reviewCheck.rowCount != 0) {
			return res
				.status(409)
				.json({ error: "Review already exists for this user." });
		}
		const trimmedBeer_id = req.body.beer_id.trim();

		try {
			if (!rating || !review || !beer_id) {
				return res.status(400).json({ error: "Missing required fields" });
			}

			await client.query("BEGIN");

			const reviewResult = await pool.query(
				"INSERT INTO beer_reviews (author_id, beer_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING *",
				[userId, trimmedBeer_id, rating, review],
			);
			const reviewId = reviewResult.rows[0].id;
			const files = req.files as Express.Multer.File[];

			if (files && files.length > 0) {
				const photoInserts = files.map(async (file, index) => {
					const uploadPath = path.join(__dirname, "..", `uploads/`);
					if (!fs.existsSync(uploadPath)) {
						fs.mkdirSync(uploadPath, { recursive: true });
					}
					const newFileName = `${reviewId}-${index}.webp`;
					const uploadFilePathAndFile = path.join(uploadPath, newFileName);
					await sharp(file.buffer)
						.webp({ lossless: true })
						.toFile(uploadFilePathAndFile);
					const relativeUploadFilePathAndFile = `/uploads/${newFileName}`;
					client.query(
						`INSERT INTO review_photos (review_id, photo_url, position, user_id)
					VALUES ($1, $2, $3, $4)`,
						[reviewId, relativeUploadFilePathAndFile, index, userId],
					);
				});
				await Promise.all(photoInserts);
			}

			await client.query("COMMIT");
			res.locals.createdReview = reviewId;
			res.status(201).json({ message: "Review Created", reviewId });
		} catch (error) {
			await client.query("ROLLBACK");
			console.error(error);
			res.status(500).json({ error: "Server error" });
		} finally {
			client.release();
		}
	},
);
//update review
router.put(
	"/review/:id",
	authenticationHandler,
	upload.array("photos", 4),
	fileValidator,
	(req, res, next) => {
		console.log("req.body:", req.body);
		console.log("deleted:", req.body.deleted);
		console.log("typeof deleted:", typeof req.body.deleted);
		next();
	},
	validate({ params: idParamSchema, body: EditReviewSchema }),
	activityLogger({
		action: "review_edited",
		entityType: "reviews",
		getEntityId: (_req, res) => res.locals.editedReview,
	}),
	async (req: Request, res: Response) => {
		const reviewID = req.params.id;
		const client = await pool.connect();

		try {
			if (!req.user?.id) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { rating, review, beer_id, deleted } = req.body;

			if (!rating || !review || !beer_id) {
				return res.status(400).json({ error: "Missing required fields" });
			}

			const numberRating = Number(rating);
			const trimmedBeerId = beer_id.trim();
			const userId = req.user.id;

			const reviewCheck = await reviewLookup(reviewID);

			if (reviewCheck.rowCount === 0) {
				return res.status(404).json({ error: "Review does not exist" });
			}

			const reviewUserCheck = await reviewUser(reviewID);

			if (userId !== reviewUserCheck.rows[0].author_id) {
				return res.status(403).json({ error: "User not authorized" });
			}

			const files = req.files as Express.Multer.File[];

			await client.query("BEGIN");

			// Update review
			await client.query(
				`UPDATE beer_reviews
         SET rating = $1, review = $2, beer_id = $3
         WHERE id = $4`,
				[numberRating, review, trimmedBeerId, reviewID],
			);

			// Delete requested photos
			for (const fileId of deleted) {
				const photoCheck = await photoLookup(fileId);

				if (photoCheck.rowCount === 0) continue;

				if (photoCheck.rows[0].user_id !== userId) {
					throw new Error("Unauthorized photo deletion");
				}

				const filePath = path.join(
					__dirname,
					"..",
					photoCheck.rows[0].photo_url,
				);

				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}

				await client.query("DELETE FROM review_photos WHERE id = $1", [fileId]);
			}

			// Handle new uploads
			if (files && files.length > 0) {
				const reviewPhotos = await reviewPhotoLookup(reviewID);
				const currentCount = reviewPhotos.rowCount ?? 0;
				const existingPositions = reviewPhotos.rows.map((p) => p.position);
				const usedPositions = new Set(existingPositions);

				const requestPhotosCount = files.length;

				if (currentCount + requestPhotosCount > 4) {
					return res.status(400).json({ error: "Photo limit exceeded" });
				}

				const uploadPath = path.join(__dirname, "..", "uploads");

				if (!fs.existsSync(uploadPath)) {
					fs.mkdirSync(uploadPath, { recursive: true });
				}

				for (const file of files) {
					let position = 0;

					while (usedPositions.has(position)) {
						position++;
					}

					usedPositions.add(position);

					const newFileName = `${reviewID}-${position}.webp`;
					const filePath = path.join(uploadPath, newFileName);

					await sharp(file.buffer).webp({ lossless: true }).toFile(filePath);

					const relativePath = `/uploads/${newFileName}`;

					await client.query(
						`INSERT INTO review_photos (review_id, photo_url, position, user_id)
             VALUES ($1, $2, $3, $4)`,
						[reviewID, relativePath, position, userId],
					);
				}
			}

			await client.query("COMMIT");

			res.locals.editedReview = reviewID;

			return res.status(200).json({
				message: "Review updated successfully",
			});
		} catch (error) {
			await client.query("ROLLBACK");
			console.error(error);

			return res.status(500).json({
				error: "Error updating review",
			});
		} finally {
			client.release();
		}
	},
);

//delete review photo
router.delete(
	"/review/photo/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "review_deletePhoto",
		entityType: "reviews_photos",
		getEntityId: (_req, res) => res.locals.deletedReviewPhoto,
	}),
	async (req: Request, res: Response) => {
		const photoId = req.params.id;
		const photoCheck = await photoLookup(photoId);

		if (photoCheck.rowCount === 0) {
			return res.status(404).json({ error: "Photo does not exist" });
		}
		if (
			photoCheck.rows[0].user_id !== req.user!.id &&
			req.user!.role != "admin"
		) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		try {
			await pool.query(
				"UPDATE review_photos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
				[photoId],
			);
			res.locals.deletedReviewPhoto = photoId;
			res.sendStatus(200);
		} catch (error) {
			console.error("Error deleting photo", error);
			res.status(500).json({ error: "Error deleting photo" });
		}
	},
);

//delete review
router.delete(
	"/review/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "review_soft_delete",
		entityType: "reviews",
		getEntityId: (_req, res) => res.locals.deletedReview,
	}),
	async (req: Request, res: Response) => {
		const reviewID = req.params.id;
		const reviewcheck = await reviewLookup(reviewID);
		if (reviewcheck.rowCount == 0) {
			return res.status(401).json({ error: "review does not exist" });
		}
		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const userId = req.user?.id;
		const userRole = req.user?.role;
		const reviewuser = await reviewUser(reviewID);
		if (userId !== reviewuser.rows[0].author_id && userRole !== "admin") {
			return res.status(400).json({ error: "User not authorized" });
		}
		try {
			await pool.query(
				"UPDATE beer_reviews SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
				[reviewID],
			);
			await pool.query(
				"UPDATE review_photos SET deleted_at = NOW() WHERE review_id = $1 AND deleted_at IS NULL",
				[reviewID],
			);
			res.locals.deletedReview = reviewID;
			res.status(200).json({ message: "Review soft deleted" });
		} catch (error) {
			console.error("Error deleting review", error);
			res.status(500).json({ error: "Error deleting review" });
		}
	},
);

router.put(
	"/review/delete/undo/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "review_undo_soft_delete",
		entityType: "reviews",
		getEntityId: (_req, res) => res.locals.deletedReview,
	}),
	async (req: Request, res: Response) => {
		const reviewID = req.params.id;
		const reviewcheck = await softDeletedReviewLookup(reviewID);
		if (reviewcheck.rowCount == 0) {
			return res
				.status(401)
				.json({ error: "review does not exist or is not soft deleted" });
		}
		const decodedToken = decodeToken(req);
		if (!decodedToken.id) {
			return res.status(401).json({ error: "token invalid" });
		}

		const userId = req.user?.id;
		const userRole = req.user?.role;
		const reviewuser = await reviewUser(reviewID);
		if (userId !== reviewuser.rows[0].author_id && userRole !== "admin") {
			return res.status(400).json({ error: "User not authorized" });
		}
		try {
			await pool.query(
				"UPDATE beer_reviews SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL",
				[reviewID],
			);
			await pool.query(
				"UPDATE review_photos SET deleted_at = NULL WHERE review_id = $1 AND deleted_at IS NOT NULL",
				[reviewID],
			);
			res.locals.deletedReview = reviewID;
			res.status(200).json({ message: "Review soft delete undone" });
		} catch (error) {
			console.error("Error deleting review", error);
			res.status(500).json({ error: "Error deleting review" });
		}
	},
);

router.get(
	"/deleted",
	authenticationHandler,
	express.json(),
	validate({ query: querySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, QueryType>,
		res: Response,
	) => {
		try {
			if (req.user?.role !== "admin") {
				return res.status(403).json({ error: "User not authorized" });
			}

			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;
			const mainQuery = `
            SELECT 
            beers.id, 
            beers.name, 
            beers.brewery_id, 
            breweries.name AS brewery_name, 
            beers.description, beers.style, 
            beers.ibu, 
            beers.abv, 
            beers.color, 
            beers.cover_image, 
            beers.date_updated, 
            beers.author_id,
            beer_authors.display_name AS author_name,
            beer_authors.id AS author_id,
            beers.date_created,
            beers.deleted_at
            FROM beers 
            LEFT JOIN users AS beer_authors ON beers.author_id = beer_authors.id
            LEFT JOIN breweries ON beers.brewery_id = breweries.id 
            WHERE beers.deleted_at IS NOT NULL
            ORDER BY beers.deleted_at DESC
            LIMIT $1 OFFSET $2
        `;
			const countQuery = `SELECT COUNT(*) FROM beers WHERE deleted_at IS NOT NULL`;

			const [beersResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const totalItems = parseInt(countResult.rows[0].count);

			const beers: Beer[] = beersResult.rows;
			const modifiedBeers = beers.map((beer) => {
				return {
					...beer,
					abv: beer.abv / 10,
				};
			});
			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: modifiedBeers,
			});
		} catch (error) {
			console.error("Error fetching deleted beers", error);
			res.status(500).json({ error: "Error fetching deleted beers" });
		}
	},
);

router.get(
	"/deleted/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema, query: querySchema }),
	async (req: Request<any, any, any, QueryType>, res: Response) => {
		try {
			if (req.user?.role !== "admin") {
				return res.status(403).json({ error: "User not authorized" });
			}

			const beerId = req.params.id;
			const limit = Number(req.query.limit) || 10;
			const offset = Number(req.query.offset) || 0;

			const beerResult = await pool.query(
				`SELECT
          beers.id,
          beers.name,
          beers.brewery_id,
          breweries.name AS brewery_name,
          beers.description,
          beers.style,
          beers.ibu,
          beers.abv,
          beers.color,
          beers.author_id,
          beer_authors.display_name AS author_name,
          beer_authors.id AS author_id,
          beers.date_updated,
          beers.date_created,
          beers.deleted_at,
          beers.cover_image
        FROM beers
        LEFT JOIN breweries ON beers.brewery_id = breweries.id
        LEFT JOIN users AS beer_authors ON beers.author_id = beer_authors.id
        WHERE beers.id = $1 AND beers.deleted_at IS NOT NULL`,
				[beerId],
			);

			if (beerResult.rows.length === 0) {
				return res.status(404).json({ error: "Deleted beer not found" });
			}

			const beer = beerResult.rows[0];
			beer.abv = beer.abv / 10;

			const reviewsResult = await pool.query(
				`SELECT
          beer_reviews.id,
          beer_reviews.rating,
          beer_reviews.review,
          beer_reviews.author_id,
          review_authors.display_name AS author_name,
          beer_reviews.date_updated,
          beer_reviews.date_created,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', review_photos.id,
                  'photo_url', review_photos.photo_url,
                  'date_updated', review_photos.date_updated,
                  'position', review_photos.position
                )
                ORDER BY review_photos.date_created DESC
              )
              FROM review_photos
              WHERE review_photos.review_id = beer_reviews.id AND review_photos.deleted_at IS NULL
            ),
            '[]'
          ) AS photos
        FROM beer_reviews
        LEFT JOIN users AS review_authors 
          ON beer_reviews.author_id = review_authors.id
        WHERE beer_reviews.beer_id = $1 AND beer_reviews.deleted_at IS NULL
        ORDER BY beer_reviews.date_created DESC
        LIMIT $2 OFFSET $3`,
				[beerId, limit, offset],
			);

			const totalResult = await pool.query(
				`SELECT COUNT(*) FROM beer_reviews WHERE beer_id = $1 AND deleted_at IS NULL`,
				[beerId],
			);

			const totalReviews = Number(totalResult.rows[0].count);

			res.json({
				...beer,
				reviews: reviewsResult.rows,
				pagination: {
					totalItems: totalReviews,
					limit,
					offset,
				},
			});
		} catch (error) {
			console.error("Error fetching deleted beer", error);
			res.status(500).json({ error: "Error fetching deleted beer" });
		}
	},
);

// Add new route for deleted reviews
router.get(
	"/deleted/reviews/all",
	authenticationHandler,
	express.json(),
	validate({ query: querySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, QueryType>,
		res: Response,
	) => {
		try {
			if (req.user?.role !== "admin") {
				return res.status(403).json({ error: "User not authorized" });
			}

			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;

			const mainQuery = `
            SELECT 
            beer_reviews.id,
            beer_reviews.author_id,
            beer_reviews.beer_id,
            beer_reviews.review,
            beer_reviews.rating,
            beer_reviews.date_created,
            beer_reviews.date_updated,
            beer_reviews.deleted_at,
            users.display_name AS author_name,
            beers.name AS beer_name,
			beer.deleted_at,
            breweries.name AS brewery_name,
            COALESCE(
                json_agg(
                    json_build_object(
                        'id', review_photos.id,
                        'photo_url', review_photos.photo_url,
                        'date_updated', review_photos.date_updated,
                        'position', review_photos.position
                    )
                ) FILTER (WHERE review_photos.id IS NOT NULL), '[]'
            ) AS photos
        FROM beer_reviews
        LEFT JOIN users ON beer_reviews.author_id = users.id
        LEFT JOIN beers ON beer_reviews.beer_id = beers.id
        LEFT JOIN breweries ON beers.brewery_id = breweries.id
        LEFT JOIN review_photos ON beer_reviews.id = review_photos.review_id
        WHERE beer_reviews.deleted_at IS NOT NULL
        GROUP BY
            beer_reviews.id,
            beer_reviews.author_id,
            beer_reviews.beer_id,
            beer_reviews.review,
            beer_reviews.rating,
            beer_reviews.date_created,
            beer_reviews.date_updated,
            beer_reviews.deleted_at,
            users.display_name,
            beers.name,
            breweries.name
        ORDER BY beer_reviews.deleted_at DESC
        LIMIT $1 OFFSET $2
        `;
			const countQuery = `SELECT COUNT(*) FROM beer_reviews WHERE deleted_at IS NOT NULL`;

			const [reviewsResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const totalItems = parseInt(countResult.rows[0].count);

			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: reviewsResult.rows,
			});
		} catch (error) {
			console.error("Error fetching deleted reviews", error);
			res.status(500).json({ error: "Error fetching deleted reviews" });
		}
	},
);

// Add new route for deleted photos
router.get(
	"/deleted/photos/all",
	authenticationHandler,
	express.json(),
	validate({ query: querySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, QueryType>,
		res: Response,
	) => {
		try {
			if (req.user?.role !== "admin") {
				return res.status(403).json({ error: "User not authorized" });
			}

			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;

			const mainQuery = `
            SELECT 
            review_photos.id,
            review_photos.review_id,
            review_photos.photo_url,
            review_photos.position,
            review_photos.user_id,
            review_photos.date_updated,
            review_photos.deleted_at,
            beer_reviews.rating,
            beer_reviews.review,
            users.display_name AS author_name,
            beers.name AS beer_name
        FROM review_photos
        LEFT JOIN beer_reviews ON review_photos.review_id = beer_reviews.id
        LEFT JOIN users ON review_photos.user_id = users.id
        LEFT JOIN beers ON beer_reviews.beer_id = beers.id
        WHERE review_photos.deleted_at IS NOT NULL
        ORDER BY review_photos.deleted_at DESC
        LIMIT $1 OFFSET $2
        `;
			const countQuery = `SELECT COUNT(*) FROM review_photos WHERE deleted_at IS NOT NULL`;

			const [photosResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const totalItems = parseInt(countResult.rows[0].count);

			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: photosResult.rows,
			});
		} catch (error) {
			console.error("Error fetching deleted photos", error);
			res.status(500).json({ error: "Error fetching deleted photos" });
		}
	},
);

// Hard delete beer (admin only)
router.delete(
	"/admin/hard-delete/beer/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "beer_hard_deleted",
		entityType: "beers",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const client = await pool.connect();
		const beerID = req.params.id;

		if (req.user?.role !== "admin") {
			return res.status(403).json({ error: "User not authorized" });
		}
		try {
			await client.query("BEGIN");

			const beerResult = await client.query(
				"SELECT id FROM beers WHERE id = $1",
				[beerID],
			);

			if (beerResult.rowCount === 0) {
				return res.status(404).json({ error: "Beer not found" });
			}

			// Get cover image before deleting
			const beerCoverImageRes = await beerCoverImageLookup(beerID);
			if (beerCoverImageRes.rowCount && beerCoverImageRes.rowCount > 0) {
				const coverImagePathAndFile = beerCoverImageRes.rows[0].cover_image;
				if (coverImagePathAndFile) {
					const filePath = path.join(__dirname, "..", coverImagePathAndFile);
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				}
			}

			// Delete all review photos for reviews of this beer
			const reviewPhotos = await client.query(
				`SELECT review_photos.id, review_photos.photo_url FROM review_photos
				INNER JOIN beer_reviews ON review_photos.review_id = beer_reviews.id
				WHERE beer_reviews.beer_id = $1`,
				[beerID],
			);

			for (const photo of reviewPhotos.rows) {
				const filePath = path.join(__dirname, "..", photo.photo_url);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			}

			// Hard delete all review photos and reviews for this beer
			await client.query(
				`DELETE FROM review_photos WHERE review_id IN (
					SELECT id FROM beer_reviews WHERE beer_id = $1
				)`,
				[beerID],
			);

			await client.query("DELETE FROM beer_reviews WHERE beer_id = $1", [
				beerID,
			]);

			// Hard delete the beer
			await client.query("DELETE FROM beers WHERE id = $1", [beerID]);

			await client.query("COMMIT");

			res.status(200).json({ message: "Beer permanently deleted" });
		} catch (error) {
			await client.query("ROLLBACK");
			console.error("Error hard deleting beer", error);
			res.status(500).json({ error: "Error hard deleting beer" });
		} finally {
			client.release();
		}
	},
);

// Hard delete beer review (admin only)
router.delete(
	"/admin/hard-delete/review/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "review_hard_deleted",
		entityType: "reviews",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const client = await pool.connect();
		const reviewID = req.params.id;

		if (req.user?.role !== "admin") {
			return res.status(403).json({ error: "User not authorized" });
		}
		try {
			await client.query("BEGIN");
			const reviewResult = await client.query(
				"SELECT id FROM beer_reviews WHERE id = $1",
				[reviewID],
			);

			if (reviewResult.rowCount === 0) {
				return res.status(404).json({ error: "Review not found" });
			}
			// Get all photos for this review
			const reviewPhotos = await client.query(
				"SELECT id, photo_url FROM review_photos WHERE review_id = $1",
				[reviewID],
			);

			// Delete photo files from filesystem
			for (const photo of reviewPhotos.rows) {
				const filePath = path.join(__dirname, "..", photo.photo_url);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			}

			// Hard delete review photos
			await client.query("DELETE FROM review_photos WHERE review_id = $1", [
				reviewID,
			]);

			// Hard delete the review
			await client.query("DELETE FROM beer_reviews WHERE id = $1", [reviewID]);
			await client.query("COMMIT");

			res.status(200).json({ message: "Review permanently deleted" });
		} catch (error) {
			await client.query("ROLLBACK");
			console.error("Error hard deleting review", error);
			res.status(500).json({ error: "Error hard deleting review" });
		} finally {
			client.release();
		}
	},
);

// Hard delete review photo (admin only)
router.delete(
	"/admin/hard-delete/photo/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "photo_hard_deleted",
		entityType: "review_photos",
		getEntityId: (req) => req.params.id,
	}),
	async (req: Request, res: Response) => {
		const photoID = req.params.id;
		const client = await pool.connect();

		if (req.user?.role !== "admin") {
			return res.status(403).json({ error: "User not authorized" });
		}
		try {
			await client.query("BEGIN");
			const photoResult = await client.query(
				"SELECT photo_url FROM review_photos WHERE id = $1",
				[photoID],
			);

			if (photoResult.rowCount === 0) {
				return res.status(404).json({ error: "Photo not found" });
			}
			const photoUrl = photoResult.rows[0].photo_url;
			const filePath = path.join(__dirname, "..", photoUrl);

			// Delete photo file from filesystem
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}

			// Hard delete the photo record
			await client.query("DELETE FROM review_photos WHERE id = $1", [photoID]);
			await client.query("COMMIT");
			res.status(200).json({ message: "Photo permanently deleted" });
		} catch (error) {
			await client.query("ROLLBACK");
			console.error("Error hard deleting photo", error);
			res.status(500).json({ error: "Error hard deleting photo" });
		} finally {
			client.release();
		}
	},
);

router.get(
	"/admin/beers",
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

			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;
			const deleted = req.query.deleted || "false";

			let whereClause = "";

			if (deleted === "true") {
				whereClause = "WHERE beers.deleted_at IS NOT NULL";
			} else if (deleted === "false") {
				whereClause = "WHERE beers.deleted_at IS NULL";
			}
			// deleted === "all" → no WHERE clause

			const mainQuery = `
				SELECT 
					beers.id, 
					beers.name, 
					beers.brewery_id, 
					breweries.name AS brewery_name, 
					beers.description, 
					beers.style, 
					beers.ibu, 
					beers.abv, 
					beers.color, 
					beers.cover_image, 
					beers.date_updated, 
					beers.author_id,
					beer_authors.display_name AS author_name,
					beer_authors.id AS author_id,
					beers.deleted_at,
					beers.date_created
				FROM beers
				LEFT JOIN users AS beer_authors 
					ON beers.author_id = beer_authors.id
				LEFT JOIN breweries 
					ON beers.brewery_id = breweries.id
				${whereClause}
				ORDER BY beers.date_updated DESC
				LIMIT $1 OFFSET $2
			`;

			const countQuery = `
				SELECT COUNT(*)
				FROM beers
				${whereClause}
			`;

			const [beersResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const totalItems = parseInt(countResult.rows[0].count);

			const beers: Beer[] = beersResult.rows;

			const modifiedBeers = beers.map((beer) => ({
				...beer,
				abv: beer.abv / 10,
			}));

			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: modifiedBeers,
			});
		} catch (error) {
			console.error("Error fetching beers", error);
			res.status(500).json({ error: "Error fetching beers" });
		}
	},
);

router.get(
	"/admin/reviews",
	express.json(),
	validate({ query: deletedAtQuerySchema }),
	async (
		req: Request<Record<string, never>, unknown, unknown, DeletedAtQueryType>,
		res: Response,
	) => {
		try {
			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;
			const deleted = req.query.deleted || "false";

			let whereClause = "WHERE b.deleted_at IS NULL";

			if (deleted === "true") {
				whereClause += " AND br.deleted_at IS NOT NULL";
			} else if (deleted === "false") {
				whereClause += " AND br.deleted_at IS NULL";
			}

			const mainQuery = `
				SELECT 
					br.id,
					br.review,
					br.rating,
					br.deleted_at,
					br.author_id,
					u.display_name AS author_name,
					br.beer_id,
					b.name AS beer_name,
					bw.id AS brewery_id,
					bw.name AS brewery_name,
					br.date_created,
					br.date_updated,
					br.deleted_at
				FROM beer_reviews br
				LEFT JOIN users u ON br.author_id = u.id
				LEFT JOIN beers b ON br.beer_id = b.id
				LEFT JOIN breweries bw ON b.brewery_id = bw.id
				${whereClause}
				ORDER BY br.date_updated DESC
				LIMIT $1 OFFSET $2
			`;

			const countQuery = `
				SELECT COUNT(*)
				FROM beer_reviews br
				LEFT JOIN beers b ON br.beer_id = b.id
				${whereClause}
			`;

			const [reviewsResult, countResult] = await Promise.all([
				pool.query(mainQuery, [limit, offset]),
				pool.query(countQuery),
			]);

			const totalItems = parseInt(countResult.rows[0].count);

			res.json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: reviewsResult.rows,
			});
		} catch (error) {
			console.error("Error fetching reviews", error);
			res.status(500).json({ error: "Error fetching reviews" });
		}
	},
);

export default router;
