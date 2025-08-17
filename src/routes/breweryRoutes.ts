import { Router, Request, Response } from "express";
import pool from "../utils/db";
import { tokenUser, decodeToken } from "../utils/userlib";
import multer from "multer";
import fs from 'fs';
import path from 'path';
import { FileFilterCallback } from "multer";
import sharp from "sharp";
import { userIdGet } from "./userRoutes";
const { authenticationHandler } = require("../utils/middleware");


const router = Router();

interface CustomRequest extends Request {
  file?: Express.Multer.File; // For single file uploads
  files?: Express.Multer.File[]; // For multiple file uploads (array of files)
}

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

declare global {
  namespace Express {
    interface Request {
      user?: {id: string};
    }
  }
}

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


async function brewerylookup(breweryID: String) {
	return await pool.query("SELECT id, name, location, date_of_founding, author_id FROM breweries WHERE id = $1", [breweryID]);
  }

async function breweryUser(breweryID: String) {
	return await pool.query("SELECT author_id FROM breweries WHERE id = $1", [breweryID]);
  }

async function breweryCoverImageLookup(breweryID: String) {
	return await pool.query("SELECT cover_image FROM breweries WHERE id = $1", [breweryID]);
  }


router.get("/", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT * FROM breweries ORDER BY date_updated DESC");
		const breweries: Brewery[] = result.rows;
		res.json(breweries);
	  } catch (error) {
		console.error("Error fetching breweries", error);
		res.status(500).json({ error: "Error fetching breweries" });
	  }
	});

router.get("/list", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT id FROM breweries");
		const breweries: Brewery[] = result.rows;
		res.json(breweries);
		} catch (error) {
		console.error("Error fetching breweries", error);
		res.status(500).json({ error: "Error fetching breweries" });
		}
	});	

router.get("/:id", async (req: Request, res: Response) => {
	const breweryId = req.params.id
	try {
		const result = await pool.query(`SELECT 
	breweries.id, 
	breweries.name, 
	breweries.location, 
	breweries.date_of_founding, 
	breweries.date_created, 
	breweries.date_updated, 
	brewery_authors.display_name, 
	breweries.author_id, 
	COALESCE(json_agg(json_build_object(
		'id', beers.id,
		'name', beers.name,
		'style', beers.style,
		'ibu', beers.ibu,
		'abv', beers.abv,
		'color', beers.color,
		'description', beers.description,
		'date_created', beers.date_created,
		'date_updated', beers.date_updated,
		'author_id', beers.author_id,
		'author_name', beer_authors.display_name)
	) FILTER (WHERE beers.id IS NOT NULL), '[]') AS beers 
FROM breweries 
LEFT JOIN users AS brewery_authors ON breweries.author_id = brewery_authors.id 
LEFT JOIN beers ON breweries.id = beers.brewery_id 
LEFT JOIN users AS beer_authors ON beers.author_id = beer_authors.id
WHERE breweries.id = $1 
GROUP BY breweries.id, brewery_authors.display_name;`, [breweryId])
		const breweries: Brewery[] = result.rows[0];
		res.json(breweries)
	} catch (error) {
		console.error("Error fetching breweries", error)
		res.status(500).json({ error: "Error fetching breweries" })
	}
})	

router.post("/", authenticationHandler, upload.single('cover_image'), async (req: Request, res: Response) => {
	const { name, location, date_of_founding } = req.body;

	var newFileName = null
	var relativeUploadFilePathAndFile = null

	if (!req.user || !req.user.id) {
	return res.status(401).json({ error: "Unauthorized: user not found" });
	}
	const user = await pool.query(
	"SELECT * FROM users WHERE id = $1", [req.user.id]
	);
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid brewery name data" });
	}
	if (req.file) {
	
		const uploadPath = path.join(__dirname, '..', `uploads/${name}`);
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}
		const ext: string = req.file && req.file.originalname ? path.extname(req.file.originalname) : '';
		newFileName = `${name}CoverImage-${Date.now()}${ext}`
		const uploadFilePathAndFile = path.join(uploadPath, newFileName)
		await sharp(req.file.buffer).resize(200,200).toFile(uploadFilePathAndFile)
		relativeUploadFilePathAndFile = `/upload/${name}/${newFileName}`
		}
	try {
	  const result = await pool.query(
		"INSERT INTO breweries (name, location, date_of_founding, author_id, cover_image) VALUES ($1, $2, $3, $4, $5) RETURNING *",
		[name, location, date_of_founding, user.rows[0].id, relativeUploadFilePathAndFile]
	  );
	  const createdBrewery: Brewery = result.rows[0];
	  res.status(201).json(createdBrewery);
	} catch (error) {
	  console.error("Error adding brewery", error);
	  res.status(500).json({ error: "Error adding brewery" });
	}
  });
 
 router.put("/:id", authenticationHandler, async (req: Request, res: Response) => {
	const breweryID = req.params.id
	const { name, location, date_of_founding } = req.body;
	var newFileName

	const brewerycheck = await brewerylookup(breweryID)
 
	if (brewerycheck.rowCount == 0) {
	 return res.status(401).json({ error: 'brewery does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const breweryuser = await breweryUser(breweryID)

	if (!req.user || !req.user.id) {
		return res.status(401).json({ error: "Unauthorized: user not found" });
	}
	const userData = await userIdGet(req.user.id)
	const userRole = userData.rows[0].role
 
	if (req.user.id !== breweryuser.rows[0].author_id || userRole !== 'admin') {
	 return res.status(400).json({ error: "User not authorized" })
	}

	const currentBrewery = brewerycheck.rows[0] 
	const updates: string[] = [];
	const values: any[] = [];
	let i = 1; // parameter index for $1, $2, etc.

	const addIfChanged = (column: string, newValue: any, transform?: (v: any) => any) => {
		const oldValue = currentBrewery[column];
		const processed = transform ? transform(newValue) : newValue;
		if (newValue !== undefined && processed !== oldValue) {
			updates.push(`${column} = $${i}`);
			values.push(processed);
			i++;
		}
	};

	addIfChanged("name", name);
	addIfChanged("location", location);
	addIfChanged("date_of_founding", date_of_founding);


	if (req.file) {
	
		const uploadPath = path.join(__dirname, '..', `uploads/${name}`);
		if (!fs.existsSync(uploadPath)) {
			fs.mkdirSync(uploadPath, { recursive: true });
		}
		const ext: string = req.file && req.file.originalname ? path.extname(req.file.originalname) : '';
		newFileName = `${name}-CoverImage-${Date.now()}${ext}`
		const uploadFilePathAndFile = path.join(uploadPath, newFileName)
		await sharp(req.file.buffer).resize(200,200).toFile(uploadFilePathAndFile)
		const relativeUploadFilePathAndFile = `/upload/${name}/${newFileName}`;
		addIfChanged("cover_image", relativeUploadFilePathAndFile);		}
 
	try {
	  await pool.query("UPDATE breweries SET name = $1, location = $2, date_of_founding = $3 WHERE id = $4", [
		name,
		location,
		date_of_founding,
		breweryID,
	  ]);
	  res.status(200).json({ messagee: "Brewery updated successfully"})
	} catch (error) {
	  res.status(500).json({ error: "Error updating brewery"});
	}
 
 
 }); 

router.delete("/:id", authenticationHandler, async (req: Request, res: Response) => {
	const breweryID = req.params.id
	const brewerycheck = await brewerylookup(breweryID)
	if (brewerycheck.rowCount == 0) {
		return res.status(401).json({ error: 'brewery does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
		return res.status(401).json({ error: 'token invalid'})
	}
	if (!req.user || !req.user.id) {
		return res.status(401).json({ error: "Unauthorized: user not found" });
	}
	const breweryUserResult = await breweryUser(breweryID)

	if (req.user.id !== breweryUserResult.rows[0].authorid) {
		return res.status(400).json({ error: "User not authorized" })
	}

	const breweryCoverImageRes = await breweryCoverImageLookup(breweryID)
		const coverImagePathAndFile = breweryCoverImageRes.rows[0].cover_image
		if(fs.existsSync(coverImagePathAndFile)) {
			fs.unlinkSync(coverImagePathAndFile)
			}

	try {
	  await pool.query("DELETE FROM breweries WHERE id = $1", [breweryID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting brewery", error);
	  res.status(500).json({ error: "Error deleting brewery" });
	}
  }); 

  

export default router;
