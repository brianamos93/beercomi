import { Router, Request, Response } from "express";
import pool from "../utils/db";
const router = Router();


router.get("/", async(req:Request, res:Response) => {
	const { q, limit, offset } = req.query
	try {
		const searchResults = await pool.query(`
      SELECT * FROM (
      SELECT 
         id,
         name,
         location AS description,
         'brewery' AS type
      FROM breweries
      WHERE name ILIKE $1
         OR location ILIKE $1
         OR date_of_founding::TEXT ILIKE $1
         OR date_created::TEXT ILIKE $1
         OR date_updated::TEXT ILIKE $1
         OR authorid::TEXT ILIKE $1

      UNION ALL

      SELECT 
         id,
         name,
         description,
         'beer' AS type
      FROM beers
      WHERE name ILIKE $1
         OR description ILIKE $1
         OR ibu::TEXT ILIKE $1
         OR abv::TEXT ILIKE $1
         OR color ILIKE $1
         OR author::TEXT ILIKE $1
      ) AS combined
      ORDER BY name
      LIMIT $2 OFFSET $3;
  `, [`%${q}%`, limit, offset])

  const results = searchResults.rows
  return res.json(results)
	} catch (error) {
      console.log(error)
      res.status(500).json({error: 'Interal Server Error'})
	}
})
export default router