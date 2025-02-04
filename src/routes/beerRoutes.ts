import { Router, Request, Response } from "express";
const jwt = require('jsonwebtoken')
import pool from "../utils/db";

const router = Router();

interface Beer {
	id: number;
	name: string;
	brewery: string;
	description: string;
	ibu: number;
	abv: number;
	color: string;
	author: string

}

async function beerlookup(beerID: Number) {
	return await pool.query("SELECT id FROM beers WHERE id = $1", [beerID]);
  }

async function beerUser(beerID: Number) {
	return await pool.query("SELECT userid FROM beers WHERE id = $1", [beerID]);
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
		const result = await pool.query("SELECT * FROM beers");
		const beers: Beer[] = result.rows;
		res.json(beers);
	  } catch (error) {
		console.error("Error fetching todos", error);
		res.status(500).json({ error: "Error fetching todos" });
	  }
	});

router.get("/:id", async (req: Request, res: Response) => {
	const beerId = parseInt(req.params.id, 10);
	try {
		const result = await pool.query("SELECT * FROM beers WHERE id = $1", [beerId])
		const beers: Beer[] = result.rows;
		res.json(beers)
	} catch (error) {
		console.error("Error fetching beers", error)
		res.status(500).json({ error: "Error fetching beers" })
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
	  return res.status(400).json({ error: "Invalid beer name data" });
	}
 
	try {
	  const result = await pool.query(
		"INSERT INTO beers (name, brewery_id, description, ibu, abv, color, author) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
		[name, brewery, description, ibu, abv, color, user.rows[0].id]
	  );
	  const createdBeer: Beer = result.rows[0];
	  res.status(201).json(createdBeer);
	} catch (error) {
	  console.error("Error adding beer", error);
	  res.status(500).json({ error: "Error adding beer" });
	}
  });

router.delete("/:id", async (req: Request, res: Response) => {
	const beerID = parseInt(req.params.id, 10);
	const beercheck = await beerlookup(beerID)
	if (beercheck.rowCount == 0) {
	 return res.status(401).json({ error: 'beer does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	// TypeScript type-based input validation
	if (isNaN(beerID)) {
	  return res.status(400).json({ error: "Invalid beer ID" });
	}
 
	const user = await tokenUser(decodedToken)
	const beerUserResult = await beerUser(beerID)
	if (user.rows[0].id !== beerUserResult.rows[0].userid) {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM beers WHERE id = $1", [beerID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting todo", error);
	  res.status(500).json({ error: "Error deleting beer" });
	}
  }); 

  router.put("/:id", async (req: Request, res: Response) => {
	const beerID = parseInt(req.params.id, 10);
	const { name, brewery, description, ibu, abv, color } = req.body;
	const beercheck = await beerlookup(beerID)
 
	if (beercheck.rowCount == 0) {
	 return res.status(401).json({ error: 'beer does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	// TypeScript type-based input validation
	if (isNaN(beerID)) {
	  return res.status(400).json({ error: "Invalid beer ID" });
	}
  
	const user = await tokenUser(decodedToken)
	const beeruser = await beerUser(beerID)
 
	if (user.rows[0].id !== beeruser.rows[0].userid) {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid beer data" });
	}
 
	try {
	  await pool.query("UPDATE todos SET name, brewery, description, ibu, abv, color = $1, $2. $3, $4, $5, $6 ,date_updated = CURRENT_TIMESTAMP WHERE id = $2", [
		name, 
		brewery, 
		description, 
		ibu, 
		abv, 
		color,
		beerID,
	  ]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating beer" });
	}
 
 
 });

export default router;
