import { Router, Request, Response } from "express";
import pool from "../utils/db";
import { tokenUser, decodeToken } from "../utils/userlib";
const express = require('express')


const router = Router();

interface Stores {
	id: string;
	name: string;
	location: string;
	date_of_founding: string;
	date_created: Date;
	date_updated: Date;
	author_id: string;
	owner: string;
	verified: boolean;
}

interface Store_menu {
	id: String;
	storeid: String;
	beerid: String;
	authorid: String;
	size: String;
	price: Number;
	date_created: Date;
	date_updated: Date;
}

async function storelookup(storeID: String) {
	return await pool.query("SELECT id FROM stores WHERE id = $1", [storeID]);
  }

async function storeUser(storeID: String) {
	return await pool.query("SELECT author_id FROM breweries WHERE id = $1", [storeID]);
  }

router.get("/", express.json(), async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT * FROM stores WHERE verified = TRUE");
		const stores: Stores[] = result.rows;
		res.json(stores);
		} catch (error) {
		console.error("Error fetching stores", error);
		res.status(500).json({ error: "Error fetching stores" });
		}
	});
	
router.get("/all", express.json(), async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT * FROM stores");
		const stores: Stores[] = result.rows;
		res.json(stores);
		} catch (error) {
		console.error("Error fetching stores", error);
		res.status(500).json({ error: "Error fetching stores" });
		}
	});
router.get("/:id", express.json(), async (req: Request, res: Response) => {
	const storeId = req.params.id
	try {
		const result = await pool.query(`SELECT 
			stores.id, 
			stores.name, 
			stores.location, 
			stores.date_of_founding, 
			stores.date_created, 
			stores.date_updated, 
			stores.author_id, 
			stores.owner, 
			stores.verified, 
			beers.name AS beer_name, 
			store_menus.size, 
			store_menus.price, 
			store_menus.date_created AS menu_date_created, 
			store_menus.date_updated AS menu_date_created 
			FROM stores 
			LEFT JOIN store_menus ON stores.id = store_menus.store_id
			LEFT JOIN beers ON store_menus.beer_id = beers.id
			WHERE stores.id = $1`, [storeId])
		const stores: Stores[] = result.rows[0];
		res.json(stores)
	} catch (error) {
		console.error("Error fetching stores", error)
		res.status(500).json({ error: "Error fetching stores" })
	}
})	

router.post("/", express.json(), async (req: Request, res: Response) => {
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
	  return res.status(400).json({ error: "Invalid store name data" });
	}
 
	try {
	  const result = await pool.query(
		"INSERT INTO stores (name, location, date_of_founding, author_id) VALUES ($1, $2, $3, $4) RETURNING *",
		[name, location, date_of_founding, user.rows[0].id]
	  );
	  const createdStore: Stores = result.rows[0];
	  res.status(201).json(createdStore);
	} catch (error) {
	  console.error("Error adding store", error);
	  res.status(500).json({ error: "Error adding store" });
	}
  });

router.delete("/:id", express.json(), async (req: Request, res: Response) => {
	const storeID = req.params.id
	const storecheck = await storelookup(storeID)
	if (storecheck.rowCount == 0) {
	 return res.status(401).json({ error: 'store does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	const user = await tokenUser(decodedToken)
	const breweryUserResult = await storeUser(storeID)
	if (user.rows[0].id !== breweryUserResult.rows[0].author_id || user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM stores WHERE id = $1", [storeID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting store", error);
	  res.status(500).json({ error: "Error deleting store" });
	}
  }); 

router.put("/:id", express.json(), async (req: Request, res: Response) => {
	const storeID = req.params.id
	const { name, location, date_of_founding } = req.body;
	const storecheck = await storelookup(storeID)
 
	if (storecheck.rowCount == 0) {
	 return res.status(401).json({ error: 'store does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const user = await tokenUser(decodedToken)
	const storeuser = await storeUser(storeID)
 
	if (user.rows[0].id !== storeuser.rows[0].author_id || user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid brewery data" });
	}
 
	try {
	  await pool.query("UPDATE stores SET name = $1, location = $2, date_of_founding = $3 WHERE id = $4", [
		name, 
		location, 
		date_of_founding,
		storeID,
	  ]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating store" });
	}
 });

router.put("/verified/:id", express.json(), async (req: Request, res: Response) => {
	const storeID = req.params.id
	const storecheck = await storelookup(storeID)
 
	if (storecheck.rowCount == 0) {
	 return res.status(401).json({ error: 'user does not exist'})
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
	  await pool.query("UPDATE stores SET verified = TRUE WHERE id = $1", [storeID]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating store" });
	}
 });

router.put("/unverified/:id", express.json(), async (req: Request, res: Response) => {
	const storeID = req.params.id
	const storecheck = await storelookup(storeID)
 
	if (storecheck.rowCount == 0) {
	 return res.status(401).json({ error: 'user does not exist'})
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
	  await pool.query("UPDATE stores SET verified = FALSE WHERE id = $1", [storeID]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating store" });
	}
 });
//per store menu query
router.get("/:id/menu", express.json(), async (req: Request, res: Response) => {
	const storeId = req.params.id
	try {
		const result = await pool.query(`SELECT menu.id, store_id, size, price, beer_id, beer_name, brewery, style, abv, ibu, color FROM (
			SELECT store_menu.id, AS menu_id, 
			store_menu.store_id,
			store_menu.size,
			store_menu.price,
			beers.id AS beer_id,
			beers.name AS beer_name,
			beers.brewery,
			beers.style,
			beers.abv,
			beers.ibu,
			beers.color,
			ROW_NUMBER() OVER (PARTITION BY store_menu.id ORDER BY store_menu.date_created DESC) AS rn FROM store_menu JOIN beers ON store_menu.beerid = beers.id WHERE store_menu.storeid = $1 ) t
			WHERE rn = 1`, [storeId])
		const menu: Store_menu[] = result.rows;
		res.json(menu)
	} catch (error) {
		console.error("Error fetching stores", error)
		res.status(500).json({ error: "Error fetching stores" })
	}
})	
//menu post
router.post("/menu/", express.json(), async (req: Request, res: Response) => {
	const { storeid, beerid, size, price } = req.body;
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	const user = await pool.query(
	 "SELECT * FROM users WHERE id = $1", [decodedToken.id]
	) 
	try {
	  const result = await pool.query(
		"INSERT INTO stores (storeid, beerid, size, price, author_id) VALUES ($1, $2, $3, $4, $5) RETURNING *",
		[storeid, beerid, size, price, user.rows[0].id]
	  );
	  const createdStore: Stores = result.rows[0];
	  res.status(201).json(createdStore);
	} catch (error) {
	  console.error("Error adding store", error);
	  res.status(500).json({ error: "Error adding store" });
	}
  });
//menu delete
router.delete("/menu/:id", express.json(), async (req: Request, res: Response) => {
	const storeID = req.params.id
	const storecheck = await storelookup(storeID)
	if (storecheck.rowCount == 0) {
	 return res.status(401).json({ error: 'store does not exist'})
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
 
	const user = await tokenUser(decodedToken)
	const breweryUserResult = await storeUser(storeID)
	if (user.rows[0].id !== breweryUserResult.rows[0].author_id || user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM stores WHERE id = $1", [storeID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting store", error);
	  res.status(500).json({ error: "Error deleting store" });
	}
  }); 
//menu put
router.put("/menu/:id", express.json(), async (req: Request, res: Response) => {
	const storeID = req.params.id
	const { name, brewery, description, ibu, abv, color } = req.body;
	const storecheck = await storelookup(storeID)
 
	if (storecheck.rowCount == 0) {
	 return res.status(401).json({ error: 'store does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const user = await tokenUser(decodedToken)
	const storeuser = await storeUser(storeID)
 
	if (user.rows[0].id !== storeuser.rows[0].author_id || user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	// TypeScript type-based input validation
	if (typeof name !== "string" || name.trim() === "") {
	  return res.status(400).json({ error: "Invalid brewery data" });
	}
 
	try {
	  await pool.query("UPDATE stores SET name = $1, brewery = $2, description = $3, ibu = $4, abv = $5, color = $6 WHERE id = $7", [
		name, 
		brewery, 
		description, 
		ibu, 
		abv, 
		color,
		storeID,
	  ]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating store" });
	}
 });

export default router;
