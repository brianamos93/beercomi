import validate from 'express-zod-safe';
import express from "express";
import { Router, Request, Response } from "express";
import {
	favoriteDeleteSchema,
	favoriteGetTableSchema,
	favoriteInputSchema,
} from "../schemas/favoriteSchema";
import { beerlookup, breweryLookup } from "./beerRoutes";
const { authenticationHandler } = require("../utils/middleware");
import pool from "../utils/config";

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
	validate({body: favoriteInputSchema}),
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
	validate({params: favoriteDeleteSchema}),
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
			res.status(200).json({ deleted: result.rows[0] })
		} catch (error) {
			console.log(error)
			res.status(500).json({Error: "Server Error"})
		}
	}
);

router.get(
	"/:table",
	express.json(),
	authenticationHandler,
	validate({params: favoriteGetTableSchema}),
	async(req: Request, res: Response) => {
		let query = ""
		if (req.params.table === "beers") {
			query = `
			SELECT id, beer_id, date_created FROM beers_favorites WHERE user_id = $1
			`
		} else if (req.params.table === "breweries") {
			query = `
			SELECT id, brewery_id, date_created FROM breweries_favorites WHERE user_id = $1
			`
		}
		try {
			const result = await pool.query(query,[req.user?.id])
			res.status(200).json(result.rows)
		} catch (error) {
			console.log(error)
			res.status(500).json({ Error: "Failed to retrieve favorites" });
		}


	}
)
export default router;
