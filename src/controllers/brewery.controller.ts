import { Request, Response, NextFunction } from "express";
import { BreweryModel } from "../models/brewery.model";
import { SearchQueryType } from "../schemas/querySchema";
import { IdParam } from "../schemas/generalSchemas";
import { imageUpload } from "../utils/lib/ImageUpload";
import { MulterRequest } from "../defs/general.defs";
import { BeerInput } from "../schemas/brewerySchemas";

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
			const result = await breweryController.getAllBreweries;
			return res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	},
	async getBreweryBeers(
		req: Request<IdParam, unknown, unknown, SearchQueryType>,
		res: Response,
		next: NextFunction,
	) {
		const breweryId = req.params.id;
		const limit = req.query.limit || 10;
		const offset = req.query.offset || 0;

		try {
			const breweryCheck = await BreweryModel.getBrewery(breweryId);
			if (breweryCheck.rowCount === 0) throw new Error("NO_BREWERY");
			const result = await BreweryModel.getBreweryBeers({
				id: breweryId,
				limit: limit,
				offset: offset,
			});
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	},
	async getBrewery(req: Request<IdParam>, res: Response, next: NextFunction) {
		const breweryId = req.params.id;
		try {
			const brewery = await BreweryModel.getBrewery(breweryId);
			if (brewery.rowCount === 0) throw new Error("NO_BREWERY");
			const result = await BreweryModel.getBreweryDetailed(breweryId);
			return res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	},
	async postBrewery(req: MulterRequest<BeerInput>, res: Response, next: NextFunction) {
		const { name, location, date_of_founding } = req.body;
		try {
			let filePath = null;
			if (req.file) {
				filePath = await imageUpload({ req });
			}
			const createdBrewery = await BreweryModel.postBrewery({
				name: name,
				location: location,
				date_of_founding: date_of_founding,
				filePath: filePath,
			});
			res.locals.createdBrewery = createdBrewery.id;
			res.status(200).json(createdBrewery)
		} catch (error) {
			next(error);
		}
	},
};
