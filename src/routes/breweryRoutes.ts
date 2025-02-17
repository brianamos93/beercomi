import { Router, Request, Response } from "express";
import pool from "../utils/db";
import { tokenUser, decodeToken } from "../utils/userlib";

const router = Router();

interface Brewery {
	id: number;
	name: string;
	location: string;
	date_of_founding: string;
	date_created: Date;
	date_updated: Date;
	author: string;
	owner: string;
}

async function brewerylookup(breweryID: String) {
	return await pool.query("SELECT id FROM breweries WHERE id = $1", [breweryID]);
  }

async function breweryUser(breweryID: String) {
	return await pool.query("SELECT author FROM breweries WHERE id = $1", [breweryID]);
  }


router.get("/", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT * FROM breweries");
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
		const result = await pool.query("SELECT * FROM breweries WHERE id = $1", [breweryId])
		const breweries: Brewery[] = result.rows[0];
		res.json(breweries)
	} catch (error) {
		console.error("Error fetching breweries", error)
		res.status(500).json({ error: "Error fetching breweries" })
	}
})	

router.post("/", async (req: Request, res: Response) => {
	const { name, location, date_of_founding } = req.body;
	const decodedToken = decodeToken(req)
	//const decodedToken = jwt.verify(getTokenFrom(req), process.env.SECRET)
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
		"INSERT INTO breweries (name, location, date_of_founding, author) VALUES ($1, $2, $3, $4) RETURNING *",
		[name, location, date_of_founding, user.rows[0].id]
	  );
	  const createdBrewery: Brewery = result.rows[0];
	  res.status(201).json(createdBrewery);
	} catch (error) {
	  console.error("Error adding brewery", error);
	  res.status(500).json({ error: "Error adding brewery" });
	}
  });

router.delete("/:id", async (req: Request, res: Response) => {
	const breweryID = req.params.id
	const brewerycheck = await brewerylookup(breweryID)
	if (brewerycheck.rowCount == 0) {
	 return res.status(401).json({ error: 'brewery does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	const user = await tokenUser(decodedToken)
	const breweryUserResult = await breweryUser(breweryID)
	if (user.rows[0].id !== breweryUserResult.rows[0].author || user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM breweries WHERE id = $1", [breweryID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting brewery", error);
	  res.status(500).json({ error: "Error deleting brewery" });
	}
  }); 

  router.put("/:id", async (req: Request, res: Response) => {
	const breweryID = req.params.id
	const { name, brewery, description, ibu, abv, color } = req.body;
	const brewerycheck = await brewerylookup(breweryID)
 
	if (brewerycheck.rowCount == 0) {
	 return res.status(401).json({ error: 'brewery does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const user = await tokenUser(decodedToken)
	const breweryuser = await breweryUser(breweryID)
 
	if (user.rows[0].id !== breweryuser.rows[0].author || user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid brewery data" });
	}
 
	try {
	  await pool.query("UPDATE breweries SET name = $1, brewery = $2, description = $3, ibu = $4, abv = $5, color = $6 WHERE id = $7", [
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
