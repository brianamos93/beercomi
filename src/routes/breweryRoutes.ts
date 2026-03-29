import { Router, Request } from "express";
import multer from "multer";

import { FileFilterCallback } from "multer";
import {
	BrewerySchemaBase,
	EditBrewerySchema,
} from "../schemas/brewerySchemas";
import {
	deletedAtQuerySchema,
	querySchema,

	searchQuerySchema,
} from "../schemas/querySchema";
import validate from "express-zod-safe";
import { idParamSchema } from "../schemas/generalSchemas";
import { activityLogger } from "../utils/middleware/activityLogger";
import { fileValidator } from "../utils/middleware/fileTyper";
import { breweryController } from "../controllers/brewery.controller";
const { authenticationHandler } = require("../utils/middleware");
import express from "express";
import { BreweryModel } from "../models/brewery.model";

const router = Router();

declare module "express-serve-static-core" {
	interface Request {
		user?: {
			id: string;
			role: string;
			display_name: string;
			profile_img_url: string;
			present_location: string;
		};
	}
}

const fileFilter = (
	_req: Request,
	file: Express.Multer.File,
	cb: FileFilterCallback,
) => {
	// Reject empty files (size 0 or name 'undefined')
	if (
		!file.originalname ||
		file.size === 0 ||
		file.originalname === "undefined"
	) {
		// Skip this file, treat as no file uploaded
		return cb(null, false);
	}
	const allowedTypes = ["image/jpeg", "image/png"];
	if (allowedTypes.includes(file.mimetype)) cb(null, true);
	else cb(new Error("Only .jpeg and .png files are allowed"));
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });

router.get(
	"/",
	express.json(),
	validate({ query: searchQuerySchema }),
	breweryController.getBrewerySearch,
);

router.get("/list", express.json(), breweryController.getAllBreweries);

// GET /breweries/:id/beers
router.get(
	"/:id/beers",
	express.json(),
	validate({ params: idParamSchema, query: querySchema }),
	breweryController.getBreweryBeers,
);

// GET /breweries/:id
router.get(
	"/:id",
	express.json(),
	validate({ params: idParamSchema }),
	breweryController.getBrewery,
);
// POST /
router.post(
	"/",
	authenticationHandler,
	upload.single("cover_image"),
	fileValidator,
	validate({ body: BrewerySchemaBase }),
	activityLogger({
		action: "brewery_post",
		entityType: "breweries",
		getEntityId: (_req, res) => res.locals.createdBrewery,
	}),
	breweryController.postBrewery,
);

router.put(
	"/:id",
	authenticationHandler,
	upload.single("cover_image"),
	fileValidator,
	validate({ body: EditBrewerySchema, params: idParamSchema }),
	activityLogger({
		action: "brewery_edited",
		entityType: "brewries",
		getEntityId: (_req, res) => res.locals.updatedBrewery,
	}),
	breweryController.putBrewery
);

router.delete(
	"/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_soft_delete",
		entityType: "breweries",
		getEntityId: (req) => req.params.id,
	}),
	BreweryModel.softDeleteBreweryCascade
);

// Get a specific soft-deleted brewery with its beers (admin only)
router.get(
	"/deleted/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema, query: querySchema }),
	breweryController.getDeletedBrewery
);

router.put(
	"/admin/undo/delete/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_undo_soft_delete",
		entityType: "breweries",
		getEntityId: (req) => req.params.id,
	}),
	breweryController.undoSoftDeleteBrewery
);

// Hard delete brewery (admin only)
router.delete(
	"/admin/hard-delete/:id",
	authenticationHandler,
	express.json(),
	validate({ params: idParamSchema }),
	activityLogger({
		action: "brewery_hard_deleted",
		entityType: "breweries",
		getEntityId: (req) => req.params.id,
	}),
	BreweryModel.hardDeleteBrewery
);

// Get all / deleted
router.get(
	"/admin/view",
	authenticationHandler,
	express.json(),
	validate({ query: deletedAtQuerySchema }),
	breweryController.hardDeleteBrewery
);

export default router;
