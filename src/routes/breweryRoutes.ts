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
	author_id: string;
	owner: string;
}

async function brewerylookup(breweryID: String) {
	return await pool.query("SELECT id FROM breweries WHERE id = $1", [breweryID]);
  }

async function breweryUser(breweryID: String) {
	return await pool.query("SELECT authorid FROM breweries WHERE id = $1", [breweryID]);
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
		'author_id', beers.author,
		'author_name', beer_authors.display_name)
	) FILTER (WHERE beers.id IS NOT NULL), '[]') AS beers 
FROM breweries 
LEFT JOIN users AS brewery_authors ON breweries.author_id = brewery_authors.id 
LEFT JOIN beers ON breweries.id = beers.brewery_id 
LEFT JOIN users AS beer_authors ON beers.author = beer_authors.id
WHERE breweries.id = $1 
GROUP BY breweries.id, brewery_authors.display_name;`, [breweryId])
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
		"INSERT INTO breweries (name, location, date_of_founding, author_id) VALUES ($1, $2, $3, $4) RETURNING *",
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

	if (user.rows[0].id !== breweryUserResult.rows[0].authorid) {
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
	const { name, location, date_of_founding } = req.body;
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
 
	if (user.rows[0].id !== breweryuser.rows[0].author_id) {
	 return res.status(400).json({ error: "User not authorized" })
	}
	console.log()
 
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

export default router;
