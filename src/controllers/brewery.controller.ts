import { Request, Response, NextFunction } from "express";
import { BreweryModel } from "../models/brewery.model";
import { DeletedAtQueryType, QueryType, SearchQueryType } from "../schemas/querySchema";
import { IdParam } from "../schemas/generalSchemas";
import { deleteCoverImageData, imageUpload } from "../utils/lib/ImageUpload";
import { MulterRequest } from "../defs/general.defs";
import { BeerInput, EditBreweryInput } from "../schemas/brewerySchemas";
import fs from "fs";


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
			const result = await BreweryModel.getBrewerySearch({
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
			const result = await BreweryModel.getAllBreweriesList();
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
	async postBrewery(
		req: MulterRequest<BeerInput>,
		res: Response,
		next: NextFunction,
	) {
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
			res.status(200).json(createdBrewery);
		} catch (error) {
			next(error);
		}
	},
	async putBrewery(
		req: MulterRequest<EditBreweryInput>,
		res: Response,
		next: NextFunction,
	) {
		const breweryID = req.params.id;
		const { name, location, date_of_founding, deleteCoverImage } = req.body;
		try {
			const breweryData = await BreweryModel.getBrewery(breweryID);
			if (breweryData.rowCount === 0) throw new Error("NO_BREWERY");
			if (
				req.user!.id !== breweryData.rows[0].author_id &&
				req.user!.role !== "admin"
			) {
				throw new Error("NOT_AUTHORIZED");
			}

			if (deleteCoverImage === true) {
				deleteCoverImageData({
					id: breweryID,
					coverImagePath: breweryData.rows[0].cover_image,
					type: 'brewery'
				});
			}
			const imageFilePath = await imageUpload({ req: req });

			const result = await BreweryModel.updateBrewery({
				name: name,
				location: location,
				date_of_founding: date_of_founding,
				relativeUploadFilePathAndFile: imageFilePath,
				breweryID: breweryID,
			});
			return res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	},
	async softDeleteBrewery(req: Request, res: Response, next: NextFunction) {
		const breweryID = req.params.id;

		const breweryData = await BreweryModel.getBrewery(breweryID);
		if (breweryData.rowCount === 0) {
			throw new Error("NO_BREWERY");
		}

		if (
			req.user!.id !== breweryData.rows[0].author_id &&
			breweryData.rows[0].role !== "admin"
		) {
			throw new Error("NOT_AUTHORIZED");
		}

		try {
			await BreweryModel.softDeleteBreweryCascade(breweryID);

			return res.status(200).json({
				message: "Brewery and related beers/reviews soft deleted",
			});
		} catch (error) {
			next(error);
		}
	},
	async getDeletedBrewery(
		req: Request<IdParam, unknown, unknown, QueryType>,
		res: Response,
		next: NextFunction,
	) {
		try {
			if (req.user?.role !== "admin") {
				throw new Error("NOT_AUTHORIZED");
			}

			const breweryId = req.params.id;
			const limit = Number(req.query.limit) || 10;
			const offset = Number(req.query.offset) || 0;

			const breweryResult = await BreweryModel.getDeletedBreweryById(breweryId);

			if (breweryResult.rows.length === 0) {
				throw new Error("NO_BREWERY");
			}

			const brewery = breweryResult.rows[0];

			const beersResult = await BreweryModel.getBeersByBreweryId(
				breweryId,
				limit,
				offset,
			);

			const countResult = await BreweryModel.countBeersByBreweryId(breweryId);
			const totalBeers = Number(countResult.rows[0].count);

			res.json({
				...brewery,
				beers: beersResult.rows,
				pagination: {
					total: totalBeers,
					limit,
					offset,
				},
			});
		} catch (error) {
			next(error);
		}
	},
	async undoSoftDeleteBrewery(
		req: Request<IdParam>,
		res: Response,
		next: NextFunction,
	) {
		try {
			const breweryID = req.params.id;

			// Check brewery exists & is soft deleted
			const brewerycheck =
				await BreweryModel.softDeletedBreweryLookup(breweryID);
			if (brewerycheck.rowCount === 0) {
				throw new Error("NO_BREWERY");
			}

			// Get author + user role
			const breweryData = await BreweryModel.getBrewery(breweryID);

			const authorId = breweryData.rows[0].author_id;

			if (req.user!.id !== authorId && req.user!.role !== "admin") {
				throw new Error("NOT_AUTHORIZED");
			}

			// Call model to handle transaction
			await BreweryModel.undoSoftDeleteTransaction(breweryID);

			return res.status(200).json({
				message: "Brewery and related beers/reviews restored",
			});
		} catch (error) {
			next(error);
		}
	},
	async hardDeleteBrewery (req: Request<Record<string, never>, unknown, unknown, DeletedAtQueryType>, res: Response, next: NextFunction) {
		const breweryID = req.params.id;

		if (req.user?.role !== "admin") {
			throw new Error("NOT_AUTHORIZED")
		}
		try {
			const { filesToDelete, notFound } =
				await BreweryModel.hardDeleteBrewery(breweryID);

			if (notFound) {
				return res.status(404).json({ error: "Brewery not found" });
			}

			// filesystem handled AFTER DB commit
			for (const filePath of filesToDelete) {
				try {
					if (fs.existsSync(filePath)) {
						fs.unlinkSync(filePath);
					}
				} catch (err) {
					console.error("File deletion failed:", filePath, err);
				}
			}

			return res.status(200).json({
				message:
					"Brewery, beers, reviews, and all associated images permanently deleted",
			});
		} catch (error) {
			next(error)
		}
	}
};
