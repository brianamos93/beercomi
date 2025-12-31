import validate from "express-zod-safe";
import express from "express";
import { Router, Request, Response } from "express";
import {
	favoriteDeleteSchema,
	favoriteGetTableSchema,
	favoriteIdSchema,
	favoriteInputSchema,
} from "../schemas/favoriteSchema";
import { beerlookup, breweryLookup } from "./beerRoutes";
const { authenticationHandler } = require("../utils/middleware");
import pool from "../utils/config";
import { querySchema, QueryType } from "../schemas/querySchema";

const router = Router();

export async function favoriteBeerLookup(id: string) {
	return await pool.query(
		"SELECT id, user_id, beer_id, date_created FROM beers_favorites WHERE id = $1",
		[id]
	);
}

export async function favoriteBreweryLookup(id: string) {
	return await pool.query(
		"SELECT id, user_id, brewery_id, date_created FROM breweries_favorites WHERE id = $1",
		[id]
	);
}

router.post(
	"/",
	express.json(),
	authenticationHandler,
	validate({ body: favoriteInputSchema }),
	async (req: Request, res: Response) => {
		const userId = req.user?.id;
		let query = "";
		if (req.body.table === "beers") {
			const beerData = await beerlookup(req.body.target_id);
			if (beerData.rowCount === 0) {
				return res.status(404).json({ Error: "Beer not found." });
			}
			query = `
				INSERT INTO beers_favorites (user_id, beer_id)
				VALUES ($1, $2)
				ON CONFLICT (user_id, beer_id) DO NOTHING
				RETURNING *;
			`;
		} else if (req.body.table === "breweries") {
			const breweryData = await breweryLookup(req.body.target_id);
			if (breweryData.rowCount === 0) {
				return res.status(404).json({ Error: "Brewery not found." });
			}
			query = `
				INSERT INTO breweries_favorites (user_id, brewery_id)
				VALUES ($1, $2)
				ON CONFLICT (user_id, brewery_id) DO NOTHING
				RETURNING *;
			`;
		}
		try {
			if (!query) return res.status(400).json({ Error: "Invalid table name" });
			const result = await pool.query(query, [userId, req.body.target_id]);
			if (result.rows.length === 0) {
				return res.status(200).json({ message: "Already favorited" });
			}
			const favoriteData = result.rows[0];
			res.status(201).json(favoriteData);
		} catch (error) {
			console.log(error);
			res.status(500).json({ Error: "Error adding to favorites" });
		}
	}
);

router.delete(
	"/:table/:id",
	express.json(),
	authenticationHandler,
	validate({ params: favoriteDeleteSchema }),
	async (req: Request, res: Response) => {
		let query = "";
		if (req.params.table === "beers") {
			const favoriteBeer = await favoriteBeerLookup(req.params.id);
			if (favoriteBeer.rowCount === 0) {
				return res.status(404).json({ Error: "Favorite beer not found." });
			}
			if (favoriteBeer.rows[0].user_id !== req.user?.id) {
				return res.status(401).json({ Error: "Unauthorized" });
			}
			query = `
			DELETE FROM beers_favorites WHERE id = $1 RETURNING *
			`;
		} else if (req.params.table === "breweries") {
			const favoriteBrewery = await favoriteBreweryLookup(req.params.id);
			if (favoriteBrewery.rowCount === 0) {
				return res.status(404).json({ Error: "Favorite brewery not found." });
			}
			if (favoriteBrewery.rows[0].user_id !== req.user?.id) {
				return res.status(401).json({ Error: "Unauthorized" });
			}
			query = `
			DELETE FROM breweries_favorites WHERE id = $1 RETURNING *
			`;
		}
		try {
			const result = await pool.query(query, [req.params.id]);
			res.status(200).json({ deleted: result.rows[0] });
		} catch (error) {
			console.log(error);
			res.status(500).json({ Error: "Server Error" });
		}
	}
);

router.get(
	"/:table",
	express.json(),
	authenticationHandler,
	validate({ params: favoriteGetTableSchema, query: querySchema }),
	async (req: Request<any, any, any, QueryType>, res: Response) => {
		const { table } = req.params;
		const limit = Number(req.query.limit) || 10;
		const offset = Number(req.query.offset) || 0;
		const userId = req.user?.id;

		let query = "";
		let countQuery = "";

		if (table === "beers") {
			query = `
		SELECT 
		beers_favorites.id, 
		beers_favorites.beer_id AS target_id, 
		beers_favorites.date_created, 
		beers.name AS beer_name, 
		breweries.name AS brewery_name, 
		'beers' AS source_table
		FROM beers_favorites
		LEFT JOIN beers
		ON beers_favorites.beer_id = beers.id
		LEFT JOIN breweries
		ON beers.brewery_id = breweries.id
		WHERE user_id = $1
		ORDER BY date_created DESC
		LIMIT $2 OFFSET $3;
      `;

			countQuery = `
        SELECT COUNT(*) AS total
        FROM beers_favorites
        WHERE user_id = $1;
      `;
		} else if (table === "breweries") {
			query = `
        SELECT 
		breweries_favorites.id, 
		breweries_favorites.brewery_id AS target_id, 
		breweries_favorites.date_created, 
		breweries.name, 
		'breweries' AS source_table
        FROM breweries_favorites
		LEFT JOIN breweries on breweries_favorites.brewery_id = breweries.id
        WHERE user_id = $1
        ORDER BY date_created DESC
        LIMIT $2 OFFSET $3;
      `;

			countQuery = `
        SELECT COUNT(*) AS total
        FROM breweries_favorites
        WHERE user_id = $1;
      `;
		} else if (table === "all") {
			query = `
		SELECT *
		FROM 
		(
		SELECT 
		beers_favorites.id, 
		beers_favorites.beer_id AS target_id, 
		beers_favorites.date_created, 
		beers.name, 
		beers.brewery_id, 
		breweries.name, 
		'beers' AS source_table
        FROM beers_favorites
		LEFT JOIN beers ON beers_favorites.beer_id = beers.id
		LEFT JOIN breweries ON beers.brewery_id = breweries.id
        WHERE user_id = $1

        UNION ALL

        SELECT 
		breweries_favorites.id, 
		breweries_favorites.brewery_id AS target_id, 
		breweries_favorites.date_created, 
		breweries.name,
		NULL AS brewery_id, 
		'breweries' AS source_table, 
		NULL AS brewery
        FROM breweries_favorites
		LEFT JOIN breweries on breweries_favorites.brewery_id = breweries.id
        WHERE user_id = $1
		
		) AS combined
        
        ORDER BY date_created DESC
        LIMIT $2 OFFSET $3;
      `;

			countQuery = `
        SELECT 
          (SELECT COUNT(*) FROM beers_favorites WHERE user_id = $1) +
          (SELECT COUNT(*) FROM breweries_favorites WHERE user_id = $1)
          AS total;
      `;
		} else {
			return res.status(400).json({ error: "Invalid table selection" });
		}

		try {
			const [favoritesResult, countResult] = await Promise.all([
				pool.query(query, [userId, limit, offset]),
				pool.query(countQuery, [userId]),
			]);

			const totalItems = Number(countResult.rows[0].total);

			res.status(200).json({
				pagination: {
					total: totalItems,
					limit,
					offset,
				},
				data: favoritesResult.rows,
			});
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Failed to retrieve favorites" });
		}
	}
);

router.get(
	"/:table/:id",
	express.json(),
	authenticationHandler,
	validate({ params: favoriteIdSchema }),
	async (req: Request, res: Response) => {
		const { table, id } = req.params;
		const tableName = table + "_favorites"
		const tableNameSingular = table.replace(/s$/, '') + "_id"
		const userId = req.user?.id;

		const query = `
			SELECT EXISTS (
			SELECT 1
			FROM ${tableName}
			WHERE user_id = $1 AND ${tableNameSingular} = $2
			);	
		`;

		try {
			const result = await pool.query(query, [ userId, id])
			if(result.rows[0].exists === true) {
				res.status(200).json({
					favorited: true
				})
			} else {
				res.status(200).json({
					favorited: false
				})
			}
			res.status(200).json(result.rows[0])
		} catch (error) {
			console.log(error);
			res.status(500).json({ Error: "Server Error" });
		}
	}
);

export default router;
