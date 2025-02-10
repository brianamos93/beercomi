import { Router, Request, Response } from "express";
import pool from "../utils/db";
const router = Router();


router.get("/:params", async(req:Request, res:Response) => {
	const searchterm = `%${req.query.q}%`
	try {
		const searchResults = await pool.query(`
    SELECT * FROM breweries
    WHERE name ILIKE $1
       OR location ILIKE $1
       OR date_of_founding ILIKE $1
       OR date_created::TEXT ILIKE $1
       OR date_updated::TEXT ILIKE $1
       OR author::TEXT ILIKE $1
       OR owner::TEXT ILIKE $1
    UNION ALL
    SELECT * FROM beers
    WHERE name ILIKE $1
       OR description ILIKE $1
       OR ibu::TEXT ILIKE $1
       OR abv::TEXT ILIKE $1
       OR color ILIKE $1
       OR author::TEXT ILIKE $1;
  `, [searchterm])
  return res.json(searchResults)
	} catch {

	}
})
export default router