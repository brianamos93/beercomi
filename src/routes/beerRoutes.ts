import { Router, Request, Response } from "express";
import pool from "../utils/db";
import { tokenUser, decodeToken } from "../utils/userlib"
const multer = require('multer')
import fs from 'fs';
import path from 'path';
import { FileFilterCallback } from "multer";
import sharp from "sharp";
const { authenticationHandler } = require("../utils/middleware");
const express = require('express')



const router = Router();

interface CustomRequest extends Request {
  file?: Express.Multer.File; // For single file uploads
  files?: Express.Multer.File[]; // For multiple file uploads (array of files)
}

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
	date_updated: Date
 
}

interface Review {
	id: string;
	author_id: string;
	beerid: string;
	review: string;
	rating: number
}

declare global {
  namespace Express {
    interface Request {
      user?: {id: string};
    }
  }
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  // Reject empty files (size 0 or name 'undefined')
  if (!file.originalname || file.size === 0 || file.originalname === 'undefined') {
    // Skip this file, treat as no file uploaded
    return cb(null, false);
  }
  const allowedTypes = ['image/jpeg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only .jpeg and .png files are allowed'));
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });


async function beerlookup(beerID: String) {
	return await pool.query("SELECT id, name, brewery_id, description, ibu, abv, color, author_id, style, cover_iamge FROM beers WHERE id = $1", [beerID]);
  }

async function beerUser(beerID: String) {
	return await pool.query("SELECT author_id FROM beers WHERE id = $1", [beerID]);
  }

 async function reviewLookup(reviewID:String) {
	return await pool.query("SELECT id FROM beer_reviews WHERE id = $1", [reviewID])
 } 

 async function reviewUser(reviewID:String) {
	return await pool.query("SELECT author_id FROM beer_reviews WHERE id = $1", [reviewID])
 }

async function breweryLookup(breweryID: String) {
	return await pool.query("SELECT name, id, location, date_of_founding, date_created, date_updated, author_id FROM breweries WHERE id = $1", [breweryID]);
  } 

async function beerCoverImageLookup(beerId: String) {
	return await pool.query("SELECT cover_image FROM beers WHERE id = $1", [beerId])
}

router.get("/", express.json(), async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT beers.id, beers.name, beers.brewery_id, breweries.name AS brewery_name, beers.description, beers.style, beers.ibu, beers.abv, beers.color, beers.cover_image, beers.date_updated, beers.date_created FROM beers LEFT JOIN breweries ON beers.brewery_id = breweries.id ORDER BY beers.date_updated DESC");
		const beers: Beer[] = result.rows;
		const modifiedBeers = beers.map((beer) => {
			return {
				...beer,
				abv: beer.abv / 10,
			}
		})
		res.json(modifiedBeers);
	  } catch (error) {
		console.error("Error fetching beers", error);
		res.status(500).json({ error: "Error fetching beers" });
	  }
	});


router.get("/list", express.json(), async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT id FROM beers");
		const beers: Beer[] = result.rows;
		res.json(beers);
		} catch (error) {
		console.error("Error fetching beers", error);
		res.status(500).json({ error: "Error fetching beers" });
		}
	});

router.get("/:id", express.json(), async (req: Request, res: Response) => {
	const beerId = req.params.id
	try {
		const result = await pool.query(`SELECT 
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
					beer_authors.id AS author_id,  -- beer author's user id
					beers.date_updated, 
					beers.date_created,
					COALESCE(json_agg(
						json_build_object(
						'id', beer_reviews.id,
						'rating', beer_reviews.rating,
						'review', beer_reviews.review,
						'author_id', review_authors.id,
						'author_name', review_authors.display_name
						)
					) FILTER (WHERE beer_reviews.id IS NOT NULL), '[]') AS reviews
					FROM beers
					LEFT JOIN breweries ON beers.brewery_id = breweries.id
					LEFT JOIN beer_reviews ON beers.id = beer_reviews.beer_id
					LEFT JOIN users AS review_authors ON beer_reviews.author_id = review_authors.id
					LEFT JOIN users AS beer_authors ON beers.author_id = beer_authors.id
					WHERE beers.id = $1
					GROUP BY 
					beers.id, 
					breweries.name, 
					beer_authors.display_name, 
					beer_authors.id;`, [beerId])
		const beer: Beer = result.rows[0];
		beer.abv = beer.abv / 10
		res.json(beer)
	} catch (error) {
		console.error("Error fetching beers", error)
		res.status(500).json({ error: "Error fetching beers" })
	}
})	

router.post("/", authenticationHandler, upload.single('cover_image'), async (req: Request, res: Response) => {
	for (const key in req.body) {
	if (typeof req.body[key] === "string") {
		req.body[key] = req.body[key].trim();
	}
	}
	const { name, brewery_id, description, style, ibu, abv, color } = req.body;
	const trimmedBrewery_id = req.body.brewery_id.trim();
	const brewery = await breweryLookup(brewery_id)
	const breweryName = brewery.rows[0].name
	var newFileName = null
	var relativeUploadFilePathAndFile = null

	if (!req.user || !req.user.id) {
	return res.status(401).json({ error: "Unauthorized: user not found" });
	}
		
	if (req.file) {

		const uploadPath = path.join(__dirname, '..', `uploads/${breweryName}/${name}`);
		if (!fs.existsSync(uploadPath)) {
 			fs.mkdirSync(uploadPath, { recursive: true });
		}
		const ext: string = req.file && req.file.originalname ? path.extname(req.file.originalname) : '';
		newFileName = `${name}-CoverImage-${Date.now()}${ext}`
		const uploadFilePathAndFile = path.join(uploadPath, newFileName)
		await sharp(req.file.buffer).resize(200,200).toFile(uploadFilePathAndFile)
		relativeUploadFilePathAndFile = `/uploads/${breweryName}/${name}/${newFileName}`
	}
	try {
	const user = await pool.query(
	 "SELECT * FROM users WHERE id = $1", [req.user.id]
	)
	if(!user) {
		return res.status(401).json({ error: 'User not found'})
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid beer name data" });
	}
 
	
		
	const formatedIbu = Number(ibu)
	const formatedAbv = Number(abv*10)
	  const result = await pool.query(
		"INSERT INTO beers (name, brewery_id, description, style, ibu, abv, color, author_id, cover_image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
		[name, trimmedBrewery_id, description, style, formatedIbu, formatedAbv, color, user.rows[0].id, relativeUploadFilePathAndFile]
	  );
	  const createdBeer: Beer = result.rows[0];
	  res.status(201).json(createdBeer);
	} catch (error) {
	  console.error("Error adding beer", error);
	  res.status(500).json({ error: "Error adding beer" });
	}
  });

router.delete("/:id", express.json(), async (req: Request, res: Response) => {
	const beerID = req.params.id
	const beercheck = await beerlookup(beerID)
	if (beercheck.rowCount == 0) {
	 return res.status(401).json({ error: 'beer does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	const user = await tokenUser(decodedToken)
	if (user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}

	const beerCoverImageRes = await beerCoverImageLookup(beerID)
	const coverImagePathAndFile = beerCoverImageRes.rows[0].cover_image
	const filePath = path.join(__dirname, '..', coverImagePathAndFile)
	if(fs.existsSync(filePath)) {
		fs.unlinkSync(filePath)
		}
		
	try {
	  	await pool.query("DELETE FROM beers WHERE id = $1", [beerID]);
	 	res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting beer", error);
	  res.status(500).json({ error: "Error deleting beer" });
	}
  }); 

router.put("/:id", express.json(), async (req: Request, res: Response) => {
	const beerID = req.params.id
	const { name, brewery_id, description, style, ibu, abv, color } = req.body;
	const beercheck = await beerlookup(beerID)
 
	if (beercheck.rowCount == 0) {
	 return res.status(401).json({ error: 'beer does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const user = await tokenUser(decodedToken)
	const beeruser = await beerUser(beerID)
 
	if (user.rows[0].id !== beeruser.rows[0].author_id) {
	 return res.status(400).json({ error: "User not authorized" })
	}
	const brewery = await breweryLookup(brewery_id)
	const breweryName = brewery.rows[0].name
	var newFileName


	const currentBeer = beercheck.rows[0];

	const updates: string[] = [];
	const values: any[] = [];
	let i = 1; // parameter index for $1, $2, etc.

	const addIfChanged = (column: string, newValue: any, transform?: (v: any) => any) => {
		const oldValue = currentBeer[column];
		const processed = transform ? transform(newValue) : newValue;
		if (newValue !== undefined && processed !== oldValue) {
			updates.push(`${column} = $${i}`);
			values.push(processed);
			i++;
		}
	};

	addIfChanged("name", name);
	addIfChanged("brewery_id", brewery_id);
	addIfChanged("description", description);
	addIfChanged("style", style);
	addIfChanged("ibu", ibu, (v) => Number(v));
	addIfChanged("abv", abv, (v) => Number(v * 10));
	addIfChanged("color", color);

		
	if (req.file) {

		const uploadPath = path.join(__dirname, '..', `uploads/${breweryName}/${name ?? currentBeer.name}`);
		if (!fs.existsSync(uploadPath)) {
 			fs.mkdirSync(uploadPath, { recursive: true });
		}
		const ext: string = req.file && req.file.originalname ? path.extname(req.file.originalname) : '';
		newFileName = `${name ?? currentBeer.name}-CoverImage-${Date.now()}${ext}`
		const uploadFilePathAndFile = path.join(uploadPath, newFileName)
		await sharp(req.file.buffer).resize(200,200).toFile(uploadFilePathAndFile)
		const relativeUploadFilePathAndFile = `/uploads/${breweryName}/${name}/${newFileName}`;
		addIfChanged("cover_image", relativeUploadFilePathAndFile);
	}

	if (updates.length === 0) {
		return res.status(200).json({ message: "No changes detected" });
	}

	values.push(beerID);
	const query = `UPDATE beers SET ${updates.join(", ")} WHERE id = $${i}`;

	try {
	  await pool.query(query, values);
		res.status(200).json({ message: "Beer updated successfully" });
	} catch (error) {
	  res.status(500).json({ error: "Error updating beer" });
	}
 });

router.get("/review/:id", express.json(), async (req: Request, res: Response) => {
	const reviewId = req.params.id
	try {
		const result = await pool.query(`SELECT
			beer_reviews.id,
			beer_reviews.author_id,
			beer_reviews.beer_id,
			beer_reviews.review,
			beer_reviews.rating,
			beer_reviews.date_created,
			beer_reviews.date_updated,
			users.display_name AS author_name,
			beers.name AS beer_name,
			breweries.name AS brewery_name
			FROM beer_reviews
			LEFT JOIN users ON beer_reviews.author_id = users.id
			LEFT JOIN beers ON beer_reviews.beer_id = beers.id
			LEFT JOIN breweries ON beers.brewery_id = breweries.id
			WHERE beer_reviews.id = $1;`, [reviewId]);
		if (result.rowCount === 0) {
			return res.status(404).json({ error: "Review not found" });
		}
		const review: Review = result.rows[0];
		res.json(review);
	} catch (error) {
		console.error("Error fetching review", error);
		res.status(500).json({ error: "Error fetching review" });
	}
})
 
//create new review
 router.post("/review/", express.json(), async (req: Request, res: Response) => {
	const { rating, review, beer } = req.body;
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	const user = await pool.query(
	 "SELECT * FROM users WHERE id = $1", [decodedToken.id]
	)
 
	try {
	  const result = await pool.query(
		"INSERT INTO beer_reviews (author_id, beer_id, rating, review) VALUES ($1, $2, $3, $4) RETURNING *",
		[user.rows[0].id, beer, rating, review]
	  );
	  const createdReview: Review = result.rows[0];
	  res.status(201).json(createdReview);
	} catch (error) {
	  console.error("Error adding beer", error);
	  res.status(500).json({ error: "Error adding beer" });
	}
  });
//update review
router.put("/review/:id", express.json(), async (req: Request, res: Response) => {
	const reviewID = req.params.id
	const { rating, review, beer } = req.body;
	const reviewcheck = await reviewLookup(reviewID)
	const numberRating = Number(rating)
 
	if (reviewcheck.rowCount == 0) {
	 return (
		res.status(401).json({ error: 'review does not exist'})
	)
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return (
		res.status(401).json({ error: 'token invalid'})
	 ) 
	 
	}
  
	const user = await tokenUser(decodedToken)
	const reviewuser = await reviewUser(reviewID)
 
	if (user.rows[0].id !== reviewuser.rows[0].author) {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("UPDATE beer_reviews SET rating = $1, review = $2, beer_id = $3 WHERE id = $4", [
		numberRating,
		review,
		beer,
		reviewID
	  ]);
	  res.status(200).json({ message: "Review updated successfully"});
	} catch (error) {
	  res.status(500).json({ error: "Error updating review" });
	}
 });
//delete review
router.delete("/review/:id", express.json(), async (req: Request, res: Response) => {
	const reviewID = req.params.id
	const reviewcheck = await reviewLookup(reviewID)
	if (reviewcheck.rowCount == 0) {
	 return res.status(401).json({ error: 'review does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	const user = await tokenUser(decodedToken)
	const reviewuser = await reviewUser(reviewID)
	if (user.rows[0].id !== reviewuser.rows[0].author_id && user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM beer_reviews WHERE id = $1", [reviewID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting review", error);
	  res.status(500).json({ error: "Error deleting review" });
	}
  }); 

export default router;
