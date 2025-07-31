import { Request } from "express";
const jwt = require('jsonwebtoken')
import pool from "../utils/db";

export async function tokenUser(decodedToken: any) {
	return await pool.query(
   "SELECT id, role, display_name FROM users WHERE id = $1",[decodedToken.id]
	);
  }

export const getTokenFrom = (req: Request) => {
	const authorization = req.get('Authorization')
	if (authorization && authorization.startsWith('Bearer ')) {
	  return authorization.replace('Bearer ', '')
	}
	return null
  }

export function decodeToken(req: Request) {
	return jwt.verify(getTokenFrom(req), process.env.SECRET);
  }
