import { Router, Request, Response } from "express";
import pool from "../utils/config";
const express = require("express");

const router = Router();

const getRecentActivity = async ({
	cursor,
	limit = 10
}: {
	cursor?: string;
	limit?: number;
}) => {
	try {
		// Step 1: Fetch all tables that contain a date_updated column
		const tableQuery = `
			SELECT table_name
			FROM information_schema.columns
			WHERE column_name = 'date_updated'
			  AND table_schema = 'public'
			  AND table_name != 'review_photos';
		`;

		const tableRes = await pool.query(tableQuery);
		const tables = tableRes.rows.map((row) => row.table_name);

		if (tables.length === 0) return [];

		// Step 2: Build UNION query
		const unionSql = tables
			.map(
				(table) => `
				SELECT 
					'${table}' AS table_name,
					${table}.id::TEXT AS id,
					${table}.date_updated AS date_updated,
					to_char(${table}.date_updated, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS date_updated_raw
				FROM ${table}
			`
			)
			.join(" UNION ALL ");

		// Step 3: Build cursor filtering
		let cursorClause = "";
		const params: any[] = [limit];

		if (cursor) {
			const [cursorDate, cursorId] = cursor.split("::");
			params.push(cursorDate);
			params.push(cursorId);

			cursorClause = `
				WHERE date_updated < $2
				   OR (date_updated = $2 AND id < $3)
			`;
		}

		// Step 4: Wrap in a subquery and paginate
		const sql = `
			WITH activity AS (
				${unionSql}
			)
			SELECT *
			FROM activity
			${cursorClause}
			ORDER BY date_updated DESC, id DESC
			LIMIT $1
		`;

		const result = await pool.query(sql, params);

		// Step 5: Build next cursor
		let nextCursor = null;
		if (result.rows.length > 0) {
			const last = result.rows[result.rows.length - 1];
			nextCursor = `${last.date_updated_raw}::${last.id}`;
		}

		return { data: result.rows, nextCursor };
	} catch (error) {
		console.log(error);
		return "Error";
	}
};


router.get("/", express.json(), async (req: Request, res: Response) => {
	try {
		const cursor = req.query.cursor as string | undefined;
		const limit = req.query.limit ? Number(req.query.limit) : 10;

		const result = await getRecentActivity({ cursor, limit });

		res.json(result);
	} catch (error) {
		console.log("Error fetching recent entries:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

export default router;