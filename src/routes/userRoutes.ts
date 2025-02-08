import { Router, Request, Response } from "express";
import pool from "../utils/db";
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
import { tokenUser, getTokenFrom, decodeToken } from "../utils/userlib";

const router = Router();

interface User {
	id: number,
	email: string,
	password: string,
	role: string,
}

async function userIdGet(userId: number) {
	return await pool.query("SELECT id, role FROM users WHERE id = $1", [userId])
}

router.post("/login", async (req: Request, res: Response) => {
	const { email, password } = req.body
	try {
		const user = await pool.query("SELECT * FROM users WHERE email = $1", [email])

		if (user.rowCount === 0) {
			return res.status(401).json({
				error: "invalid email or password"
			})
		}
		const passwordCorrect = user === null
		? false: await bcrypt.compare(password, user.rows[0].password)

		if (!(user && passwordCorrect)) {
			return res.status(401).json({
				error: "invalid email or password"
			})
		}

		const userForToken = {
			username: user.rows[0].user,
			id: user.rows[0].id,
		}

		const token = jwt.sign(userForToken,
			process.env.SECRET,
			{ expiresIn: 60*60 }
		)

		res
		.status(200)
		.send({token, userForToken})
	} catch (error) {
		console.error("Error loginning in", error)
		res.status(500).json({ error: "Error logging in" })
	}
})

router.get("/users", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT users.id, users.email, users.role FROM users")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.get("/users/beers", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT users.id, users.email, users.role, beers.name, beers.description FROM users INNER JOIN beers ON users.id = beers.author")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.get("/users/breweries", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT users.id, users.email, users.role, breweries.name, breweries.description FROM users INNER JOIN breweries ON users.id = brewery.author")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.post("/signup", async ( req: Request, res: Response ) => {
	const { email, password } = req.body

	const saltRounds = 10
	const passwordHash = await bcrypt.hash(password, saltRounds)

	try {
	const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email])

	if (emailCheck.rowCount != 0) {
		return res.status(500).json({ error: "Error" })
	}
		const result = await pool.query(
			"INSERT INTO users(email, password) VALUES($1, $2) RETURNING *", [email, passwordHash]
		)
		const createdUser: User = result.rows[0]
		res.status(201).json(createdUser)
	} catch (error) {
		console.error("Error signing up", error);
		res.status(500).json({ error: "Error signing up" });
	}
})

router.get("/user/:id", async (req: Request, res: Response ) => {
	const userID = parseInt(req.params.id, 10);
	// TypeScript type-based input validation
	if (isNaN(userID)) {
		return res.status(400).json({ error: "Invalid user ID" });
	  }
	  try {
		const result = await pool.query("SELECT beers.name FROM users JOIN beers ON users.id = beers.author WHERE users.id = $1 ", [userID]);
		const user: User[] = result.rows;
		res.json(user);
	  } catch (error) {
		console.error("Error fetching user", error);
		res.status(500).json({ error: "Error fetching user" });
	  }
})

router.delete("/user/:id", async (req: Request, res: Response) => {
	const userID = parseInt(req.params.id, 10);
 
	// TypeScript type-based input validation
	if (isNaN(userID)) {
	  return res.status(400).json({ error: "Invalid user ID" });
	}
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	const user = await tokenUser(decodedToken)
	const userDataResult = await userIdGet(userID)
	if (user.rows[0].id !== userDataResult.rows[0].id || userDataResult.rows[0].role !== "admin") {
		return res.status(400).json({ error: "User not authorized" })
	}
	try {
	  await pool.query("DELETE FROM users WHERE id = $1", [userID]);
	  res.sendStatus(200);
	} catch (error) {
	  console.error("Error deleting user", error);
	  res.status(500).json({ error: "Error deleting user" });
	}
  });

router.put("/user/:id", async (req: Request, res: Response) => {
	const userID = parseInt(req.params.id, 10);
	const { password } = req.body;

	const saltRounds = 10
	const passwordHash = await bcrypt.hash(password, saltRounds)

	try {
		await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
			passwordHash,
			userID,
     	]);
     	res.sendStatus(200);
   	} catch (error) {
	console.error("Error updating todo", error);
	res.sendStatus(500).json({ error: "Error updating todo" });
	}
});

router.put("/user/:id/role", async (req: Request, res: Response) => {
	const userID = parseInt(req.params.id, 10);
	const { role } = req.body;

	try {
		await pool.query("UPDATE users SET role = $1 WHERE id = $2", [
			role,
			userID,
     	]);
     	res.sendStatus(200);
   	} catch (error) {
	console.error("Error updating todo", error);
	res.sendStatus(500).json({ error: "Error updating todo" });
	}
});

export default router