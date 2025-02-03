import { Router, Request, Response } from "express";
const jwt = require('jsonwebtoken')
import pool from "../utils/db";

const router = Router();

interface Brewery {
	id: number;
	name: string;
	location: string;
	dateoffounding: string;
	date_created: Date;
	date_updated: Date;
	userid: string;
}

async function brewerylookup(breweryID: Number) {
	return await pool.query("SELECT id FROM breweries WHERE id = $1", [breweryID]);
  }

async function breweryUser(breweryID: Number) {
	return await pool.query("SELECT userid FROM breweries WHERE id = $1", [breweryID]);
  }

async function tokenUser(decodedToken: any) {
	return await pool.query(
   "SELECT id FROM users WHERE id = $1",[decodedToken.id]
	);
  }

const getTokenFrom = (req: Request) => {
	const authorization = req.get('Authorization')
	if (authorization && authorization.startsWith('Bearer ')) {
	  return authorization.replace('Bearer ', '')
	}
	return null
  }

function decodeToken(req: Request) {
	return jwt.verify(getTokenFrom(req), process.env.SECRET);
  }

router.get("/", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT * FROM breweries");
		const breweries: Brewery[] = result.rows;
		res.json(breweries);
	  } catch (error) {
		console.error("Error fetching todos", error);
		res.status(500).json({ error: "Error fetching todos" });
	  }
	});

router.get("/:id", async (req: Request, res: Response) => {
	const breweryId = parseInt(req.params.id, 10);
	try {
		const result = await pool.query("SELECT * FROM breweries WHERE id = $1", [breweryId])
		const breweries: Brewery[] = result.rows;
		res.json(breweries)
	} catch (error) {
		console.error("Error fetching breweries", error)
		res.status(500).json({ error: "Error fetching breweries" })
	}
})	

router.post("/", async (req: Request, res: Response) => {
	const { name, brewery, description, ibu, abv, color } = req.body;
	const decodedToken = jwt.verify(getTokenFrom(req), process.env.SECRET)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	const user = await pool.query(
	 "SELECT * FROM users WHERE id = $1", [decodedToken.id]
	)
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid brewery name data" });
	}
 
	try {
	  const result = await pool.query(
		"INSERT INTO breweries (name, brewery, description, ibu, abv, color, userid) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
		[name, brewery, description, ibu, abv, color, user.rows[0].id]
	  );
	  const createdBrewery: Brewery = result.rows[0];
	  res.status(201).json(createdBrewery);
	} catch (error) {
	  console.error("Error adding brewery", error);
	  res.status(500).json({ error: "Error adding brewery" });
	}
  });

router.delete("/:id", async (req: Request, res: Response) => {
	const breweryID = parseInt(req.params.id, 10);
	const taskcheck = await brewerylookup(breweryID)
	if (taskcheck.rowCount == 0) {
	 return res.status(401).json({ error: 'brewery does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	// TypeScript type-based input validation
	if (isNaN(breweryID)) {
	  return res.status(400).json({ error: "Invalid brewery ID" });
	}
 
	const user = await tokenUser(decodedToken)
	const breweryUserResult = await breweryUser(breweryID)
	if (user.rows[0].id !== breweryUserResult.rows[0].userid) {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM breweries WHERE id = $1", [breweryID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting todo", error);
	  res.status(500).json({ error: "Error deleting brewery" });
	}
  }); 

  router.put("/:id", async (req: Request, res: Response) => {
	const breweryID = parseInt(req.params.id, 10);
	const { name, brewery, description, ibu, abv, color } = req.body;
	const brewerycheck = await brewerylookup(breweryID)
 
	if (brewerycheck.rowCount == 0) {
	 return res.status(401).json({ error: 'brewery does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	// TypeScript type-based input validation
	if (isNaN(breweryID)) {
	  return res.status(400).json({ error: "Invalid brewery ID" });
	}
  
	const user = await tokenUser(decodedToken)
	const breweryuser = await breweryUser(breweryID)
 
	if (user.rows[0].id !== breweryuser.rows[0].userid) {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid brewery data" });
	}
 
	try {
	  await pool.query("UPDATE todos SET name, brewery, description, ibu, abv, color = $1, $2. $3, $4, $5, $6 ,date_updated = CURRENT_TIMESTAMP WHERE id = $2", [
		name, 
		brewery, 
		description, 
		ibu, 
		abv, 
		color,
		breweryID,
	  ]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating brewery" });
	}
 
 
 });

export default router;
