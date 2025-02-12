import { Router, Request, Response } from "express";
import pool from "../utils/db";
import { tokenUser, decodeToken } from "../utils/userlib"

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
	author: string
 
}

interface Review {
	id: string;
	authorid: string;
	beerid: string;
	review: string;
	rating: number
}

async function beerlookup(beerID: String) {
	return await pool.query("SELECT id FROM beers WHERE id = $1", [beerID]);
  }

async function beerUser(beerID: String) {
	return await pool.query("SELECT userid FROM beers WHERE id = $1", [beerID]);
  }

 async function reviewLookup(reviewID:String) {
	return await pool.query("SELECT id FROM beer_reviews WHERE id = $1", [reviewID])
 } 

 async function reviewUser(reviewID:String) {
	return await pool.query("SELECT authorid FROM beer_review WHERE id = $1", [reviewID])
 }

router.get("/", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT id, name, brewery, description, style, ibu, abv, color, author FROM beers");
		const beers: Beer[] = result.rows;
		res.json(beers);
	  } catch (error) {
		console.error("Error fetching beers", error);
		res.status(500).json({ error: "Error fetching beers" });
	  }
	});

router.get("/:id", async (req: Request, res: Response) => {
	const beerId = req.params.id
	try {
		const result = await pool.query("SELECT beers.id, beers.name, beers.brewery, beers.description, beers.style, beers.ibu, beers.abv, beers.color, reviews.rating, reviews.review, users.username FROM beers LEFT JOIN beer_reviews ON beers.id = beer_reviews.beerid LEFT JOIN users ON beer_reviews.authorid = users.id WHERE id = $1", [beerId])
		const beers: Beer[] = result.rows;
		res.json(beers)
	} catch (error) {
		console.error("Error fetching beers", error)
		res.status(500).json({ error: "Error fetching beers" })
	}
})	

router.post("/", async (req: Request, res: Response) => {
	const { name, brewery, description, style, ibu, abv, color } = req.body;
	const decodedToken = decodeToken(req)
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
		"INSERT INTO beers (name, brewery_id, description, style, ibu, abv, color, author) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
		[name, brewery, description, style, ibu, abv, color, user.rows[0].id]
	  );
	  const createdBeer: Beer = result.rows[0];
	  res.status(201).json(createdBeer);
	} catch (error) {
	  console.error("Error adding beer", error);
	  res.status(500).json({ error: "Error adding beer" });
	}
  });

router.delete("/:id", async (req: Request, res: Response) => {
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
	try {
	  await pool.query("DELETE FROM beers WHERE id = $1", [beerID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting beer", error);
	  res.status(500).json({ error: "Error deleting beer" });
	}
  }); 

router.put("/:id", async (req: Request, res: Response) => {
	const beerID = req.params.id
	const { name, brewery, description, style, ibu, abv, color } = req.body;
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
 
	if (user.rows[0].id !== beeruser.rows[0].userid) {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid beer data" });
	}
 
	try {
	  await pool.query("UPDATE beers SET name = $1, brewery = $2, description = $3, style = $4, ibu = $5, abv = $6, color = $7 WHERE id = $8", [
		name, 
		brewery, 
		description,
		style, 
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

//create new review
 router.post("/review/:id", async (req: Request, res: Response) => {
	const beerID = req.params.id
	const { rating, review } = req.body;
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	const user = await pool.query(
	 "SELECT * FROM users WHERE id = $1", [decodedToken.id]
	)
 
	try {
	  const result = await pool.query(
		"INSERT INTO beer_reviews (authorid, beerid, rating, review) VALUES ($1, $2, $3, $4) RETURNING *",
		[user.rows[0].id, beerID, rating, review]
	  );
	  const createdReview: Review = result.rows[0];
	  res.status(201).json(createdReview);
	} catch (error) {
	  console.error("Error adding beer", error);
	  res.status(500).json({ error: "Error adding beer" });
	}
  });
//update review
router.put("/review/:id", async (req: Request, res: Response) => {
	const reviewID = req.params.id
	const { rating, review } = req.body;
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
 
	if (user.rows[0].id !== reviewuser.rows[0].authorid) {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("UPDATE beers SET rating = $1, review = $2 WHERE id = $3", [
		rating,
		review,
		reviewID
	  ]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating review" });
	}
 });
//delete review
router.delete("/review/:id", async (req: Request, res: Response) => {
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
	if (user.rows[0].id !== reviewuser.rows[0].authorid || user.rows[0].role !== "admin") {
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
