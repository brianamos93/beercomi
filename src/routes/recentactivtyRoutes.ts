import { Router, Request, Response } from "express";
import pool from "../utils/config";
const express = require('express')


const router = Router();

const getRecentActivity = async () => {
	try {
		const tableQuery = `
		SELECT table_name
		FROM information_schema.columns
		WHERE column_name = 'date_updated' AND table_schema = 'public' AND table_name != 'review_photos';`

		const tableRes = await pool.query(tableQuery)
		const tables = tableRes.rows.map(row => row.table_name)

		if (tables.length === 0) {
			return []
		}

		let sql = tables.map(
			table => `SELECT '${table}' AS table_name, ${table}.id::TEXT AS id, ${table}.date_updated::TIMESTAMP AS date_updated FROM ${table}`
		).join(" UNION ALL ") + " ORDER BY date_updated DESC LIMIT 10"

		const result = await pool.query(sql)
		return result.rows
	} catch (error) {
		console.log(error)
		return "Error"	
	}
}

router.get("/", express.json(), async (req:Request, res:Response) => {
	try {
		const entries = await getRecentActivity()
		res.json(entries)
	} catch (error) {
		console.log("Error fetching recent entries:", error)
		res.status(500).json({ error: "Internal Server Error"})
	}
})
export default router