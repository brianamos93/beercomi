import { Request } from "express";
const jwt = require('jsonwebtoken')
import pool from "../utils/config";

export async function tokenUser(decodedToken: any) {
	return await pool.query(
   "SELECT id, role, display_name, profile_img_url FROM users WHERE id = $1",[decodedToken.id]
	);
  }

export const getTokenFrom = (req: Request) => {
  if (!req || typeof req.get !== 'function') {
    return null
  }

  const authorization = req.get('Authorization')
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7) // faster and cleaner than replace
  }

  return null
}

export function decodeToken(req: Request) {
	return jwt.verify(getTokenFrom(req), process.env.SECRET);
  }
