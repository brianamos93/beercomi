import { Router, Request, Response } from "express";
import pool from "../utils/db";
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const router = Router();

interface User {
	id: number,
	username: string,
	email: string,
	password: string
}

router.post("/login", async (req: Request, res: Response) => {
	const { username, password } = req.body
	try {
		const user = await pool.query("SELECT * FROM users WHERE username = $1", [username])

		if (user.rowCount === 0) {
			return res.status(401).json({
				error: "invalid username or password"
			})
		}
		const passwordCorrect = user === null
		? false: await bcrypt.compare(password, user.rows[0].password)

		if (!(user && passwordCorrect)) {
			return res.status(401).json({
				error: "invalid username or password"
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
		const result = await pool.query("SELECT users.id, users.username, beers.name, beers.description FROM users INNER JOIN todos ON users.id = beers.userid")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.post("/signup", async ( req: Request, res: Response ) => {
	const { username, email, password } = req.body

	const saltRounds = 10
	const passwordHash = await bcrypt.hash(password, saltRounds)

	const usernameCheck = await pool.query("SELECT id FROM users WHERE username = $1", [username])
	const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email])

	if (usernameCheck.rowCount != 0) {
		return res.status(500).json({ error: "Error"})
	}
	if (emailCheck.rowCount != 0) {
		return res.status(500).json({ error: "Error" })
	}

	try {
		const result = await pool.query(
			"INSERT INTO users(username, email, password) VALUES($1, $2, $3) RETURNING *", [username, email, passwordHash]
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
		const result = await pool.query("SELECT todos.task FROM users JOIN todos ON users.id = todos.userid WHERE users.id = $1 ", [userID]);
		const user: User[] = result.rows;
		res.json(user);
	  } catch (error) {
		console.error("Error fetching todos", error);
		res.status(500).json({ error: "Error fetching todos" });
	  }
})

router.delete("/user/:id", async (req: Request, res: Response) => {
	const userID = parseInt(req.params.id, 10);
 
	// TypeScript type-based input validation
	if (isNaN(userID)) {
	  return res.status(400).json({ error: "Invalid user ID" });
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

export default router