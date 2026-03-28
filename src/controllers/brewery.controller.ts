import { Request, Response, NextFunction } from "express";
import path from "path";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
import fs from "fs";
import sharp from "sharp";
import { BreweryModel } from "../models/brewery.model";
import { SearchQueryType } from "../schemas/querySchema";
import { IdParam } from "../schemas/generalSchemas";

export const breweryController = {
	async getBrewerySearch(
		req: Request<Record<string, never>, unknown, unknown, SearchQueryType>,
		res: Response,
		next: NextFunction,
	) {
		const limit = Number(req.query.limit) || 10;
		const offset = Number(req.query.offset) || 0;
		const searchQuery = req.query.q ? `%${req.query.q}%` : null;
		try {
			const result = BreweryModel.getBrewerySearch({
				query: searchQuery,
				limit: limit,
				offset: offset,
			});
			return res.json(result);
		} catch (error) {
			next(error);
		}
	},
	async getAllBreweries(_req: Request, res: Response, next: NextFunction) {
		try {
			const result = await breweryController.getAllBreweries
			return res.status(200).json(result)
		} catch (error) {
			next(error)
		}
	},
	async getBreweryBeers(req: Request<IdParam, unknown, unknown, SearchQueryType>, res: Response, next: NextFunction) {
		const breweryId = req.params.id
		const limit = req.query.limit || 10;
		const offset = req.query.offset || 0;

		try {
			const breweryCheck = await BreweryModel.getBrewery(breweryId)
			if (breweryCheck.rowCount === 0) throw new Error("NO_BREWERY")
			const result = await BreweryModel.getBreweryBeers({id: breweryId, limit: limit, offset: offset})
			res.status(200).json(result)
		} catch (error) {
			next(error)
		}
	}
};
