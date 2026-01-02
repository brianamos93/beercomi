import { Router, Request, Response, NextFunction } from "express";
import pool from "../utils/config";
const { authenticationHandler } = require("../utils/middleware");
import validate from "express-zod-safe";
import { querySchema, QueryType } from "../schemas/querySchema";

const router = Router();

router.get(
	"/",
	authenticationHandler,
	validate({ query: querySchema }),
	async (req: Request<any, any, any, QueryType>, res: Response, next: NextFunction) => {
		try {
			
			if (req.user?.role !== "admin") {
				return res.status(400).json({ error: "User not authorized" });
			}
			const limit = req.query.limit || 10;
			const offset = req.query.offset || 0;

			const mainQuery = `
			SELECT 
				al.id, 
				al.user_id,
				users.display_name,
				al.action,
				al.entity_type,
				al.entity_id,
				al.metadata,
				al.created_at
			FROM activity_log al
			LEFT JOIN users on al.user_id = users.id
			ORDER BY al.created_at DESC
			LIMIT $1
			OFFSET $2
			`;

			const mainResult = await pool.query(mainQuery, [limit, offset]);

			const totalResult = await pool.query(
				`
				SELECT COUNT(*) 
         		FROM activity_log 
         		`
			);
			const totalEntries = Number(totalResult.rows[0].count);

			res.json({
				data: mainResult.rows,
				pagination: {
					totalItems: totalEntries,
					limit,
					offset,
				},
			});
		} catch (error) {
			next(error)
		}
	}
);

export default router;
