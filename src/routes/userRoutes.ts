import { Router, Request, Response, NextFunction } from "express";
import pool from "../utils/db";
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
import { tokenUser, decodeToken } from "../utils/userlib";
const multer = require('multer')
import fs from 'fs';
import path from 'path';
import { FileFilterCallback } from "multer";
import sharp from "sharp";
const { authenticationHandler } = require("../utils/middleware");
interface CustomRequest extends Request {
  file?: Express.Multer.File; // For single file uploads
  files?: Express.Multer.File[]; // For multiple file uploads (array of files)
}

const getRecentActivityOneUser = async (userId: string) => {
	try {
		const tableQuery = `
			SELECT table_name
			FROM information_schema.columns
			WHERE table_schema = 'public'
			AND column_name IN ('date_updated', 'author_id')
			GROUP BY table_name
			HAVING COUNT(DISTINCT column_name) = 2;`

		const tableRes = await pool.query(tableQuery)
		const tables = tableRes.rows.map(row => row.table_name)
		console.log(tables)

		if (tables.length === 0) {
			return []
		}

		let sql = `
		SELECT *
		FROM (
			${tables.map(
			table => `
				SELECT 
				'${table}' AS table_name,
				${table}.id::TEXT AS id,
				${table}.date_updated::TIMESTAMP AS date_updated
				FROM ${table}
				WHERE author_id = '${userId}'
			`
			).join(" UNION ALL ")}
		) AS combined
		ORDER BY date_updated DESC
		LIMIT 10
`
		const result = await pool.query(sql)
		return result.rows
	} catch (error) {
		console.log(error)
		return "Error"	
	}
}

const uploadPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png'];
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only .jpeg and .png files are allowed'));
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter });


const router = Router();

interface User {
	id: number,
	display_name: string,
	email: string,
	password: string,
	role: string,
	profile_img_url: string,
	present_location: string,
	introduction: string,
}

async function userIdGet(userId: string) {
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
			display_name: user.rows[0].display_name,
			id: user.rows[0].id,
			profile_img_url: user.rows[0].profile_img_url
		}

		const token = jwt.sign(userForToken,
			process.env.SECRET,
			{ expiresIn: 60*60 }
		)
		console.log(userForToken)
		res
		.status(200)
		.send({token, userForToken})
	} catch (error) {
		console.error("Error loginning in", error)
		res.status(500).json({ error: "Error logging in" })
	}
})

router.post("/profile/img/upload", authenticationHandler, upload.single('image'), async (req: Request, res: Response) => {
	try {
		if (!req.file) return res.status(400).json({ error: "No file uploaded"})
			const decodedToken = decodeToken(req)
			const user = await tokenUser(decodedToken)
			const display_name = user.rows[0].display_name
			const ext: string = req.file && req.file.originalname ? path.extname(req.file.originalname) : '';
			const avatardir = user.rows[0].profile_img_url
			const newFileName = `${display_name}-${Date.now()}${ext}`
			const uploadFilePathAndFile = path.join(uploadPath, newFileName)
			if (avatardir !== null) {
				const oldFilePath = path.join(uploadPath, avatardir)
				if (fs.existsSync(oldFilePath)) {
					fs.unlinkSync(oldFilePath)
				}
			}
			await sharp(req.file.buffer).resize(200,200).toFile(uploadFilePathAndFile)
			const userId = user.rows[0].id
			await pool.query(`
				UPDATE users
				SET profile_img_url = $1
				WHERE id = $2
				RETURNING *;
				`, [uploadFilePathAndFile, userId])
				res.json({message: "Upload Sucessful"})
		} catch (error) {
			res.status(401).json({error: "Error uploading avatar."})
		}
})

router.delete("/profile/img", authenticationHandler, async(req: Request, res: Response) => {
    const decodedToken = decodeToken(req)
    if (!decodedToken.id) return res.status(401).json({ error: 'token invalid' })
    const user = await tokenUser(decodedToken)
    const userId = user.rows[0].id
    const avatardir = user.rows[0].profile_img_url
    if (!avatardir) return res.status(404).json({message: "Avatar Not Found."})
    const oldFilePath = path.join(uploadPath, avatardir) //error?
    if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath)
        try {
            await pool.query(`
                UPDATE users
                SET profile_img_url = null
                WHERE id = $1
                RETURNING *;
            `, [userId])
            return res.json({message: "Avatar Successfully Deleted."})
        } catch (error) {
            return res.status(500).json({error})
        }
    } else {
        // File does not exist, but clear DB reference anyway
        await pool.query(`
            UPDATE users
            SET profile_img_url = null
            WHERE id = $1
            RETURNING *;
        `, [userId])
        return res.json({message: "Avatar reference removed, file not found."})
    }
})

router.get("/users", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT users.id, users.display_name, users.role, users.profile_img_url, users.present_location, users.introduction FROM users")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.get("/users/beers", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT users.id, users.display_name, users.profile_img_url, beers.name, beers.description FROM users INNER JOIN beers ON users.id = beers.author")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.get("/users/breweries", async (req: Request, res: Response) => {
	try {
		const result = await pool.query("SELECT users.id, users.display_name, users.profile_img_url, breweries.name, breweries.description FROM users INNER JOIN breweries ON users.id = brewery.author")
		const users: User[] = result.rows
		res.json(users)
	} catch (error) {
		console.error("Error fetching users", error)
		res.status(500).json({ error: "Error fetching users" })
	}
})

router.post("/signup", async ( req: Request, res: Response ) => {
	const { display_name, email, password } = req.body

	const saltRounds = 10
	const passwordHash = await bcrypt.hash(password, saltRounds)

	try {
	const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email])
	const display_nameCheck = await pool.query("SELECT id FROM users WHERE display_name = $1", [display_name])

	if (emailCheck.rowCount != 0) {
		return res.status(500).json({ error: "Email invalid or in use" })
	}
	if (display_nameCheck.rowCount != 0) {
		return res.status(500).json({ error: "Display Name not valid or in use"})
	}
		const result = await pool.query(
			"INSERT INTO users(email, password, display_name) VALUES($1, $2, $3) RETURNING *", [email, passwordHash, display_name]
		)
		const createdUser: User = result.rows[0]
		res.status(201).json(createdUser)
	} catch (error) {
		console.error("Error signing up", error);
		res.status(500).json({ error: "Error signing up" });
	}
})

router.get("/user/", async(req: Request, res: Response) => {
	try {
		const decodedToken = decodeToken(req)
		if (!decodedToken.id) {
	 		return res.status(401).json({ error: 'token invalid'})
	}
	const userData = await tokenUser(decodedToken)
	const user = userData.rows[0]
	return res.json(user)
	} catch (error) {
		res.json({error: "Error"})
	}

})

router.get("/user/:id", async (req: Request, res: Response ) => {
	const userID = req.params.id
	  try {
		const result = await pool.query("SELECT users.id, users.display_name, users.profile_img_url, users.present_location, users.introduction, users.role FROM users WHERE users.id = $1 ", [userID]);
		const user: User[] = result.rows[0];
		res.json(user);
	  } catch (error) {
		console.error("Error fetching user", error);
		res.status(500).json({ error: "Error fetching user" });
	  }
})

router.delete("/user/:id", async (req: Request, res: Response) => {
	const userID = req.params.id
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
	const userID = req.params.id
	const { password } = req.body;

	const saltRounds = 10
	const passwordHash = await bcrypt.hash(password, saltRounds)

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
	const userID = req.params.id
	const { role } = req.body;

	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
	const user = await tokenUser(decodedToken)
	const userDataResult = await userIdGet(userID)
	if (userDataResult.rows[0].role !== "admin") {
		return res.status(400).json({ error: "User not authorized" })
	}

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

router.put("/verified/:id", async (req: Request, res: Response) => {
	const userID = req.params.id
	const usercheck = await userIdGet(userID)
 
	if (usercheck.rowCount == 0) {
	 return res.status(401).json({ error: 'user does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const user = await tokenUser(decodedToken)
 
	if (user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	try {
	  await pool.query("UPDATE users SET verification = TRUE WHERE id = $1", [userID]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating users" });
	}
 });


 router.put("/unverified/:id", async (req: Request, res: Response) => {
	const userID = req.params.id
	const usercheck = await userIdGet(userID)
 
	if (usercheck.rowCount == 0) {
	 return res.status(401).json({ error: 'user does not exist'})
	}
 
	const decodedToken = decodeToken(req)
	if (!decodedToken.id) {
	 return res.status(401).json({ error: 'token invalid'})
	}
  
	const user = await tokenUser(decodedToken)
 
	if (user.rows[0].role !== "admin") {
	 return res.status(400).json({ error: "User not authorized" })
	}
 
	try {
	  await pool.query("UPDATE users SET verification = FALSE WHERE id = $1", [userID]);
	  res.sendStatus(200);
	} catch (error) {
	  res.sendStatus(500).json({ error: "Error updating user" });
	}
 });

 router.get("/user/:id/recentactivity", async(req: Request, res: Response) => {
	const userID = req.params.id
	try {
		const entries = await getRecentActivityOneUser(userID)
		res.json(entries)
	} catch (error) {
		console.log("Error fetching recent entries:", error)
		res.status(500).json({ error: "Internal Server Error"})
	}
})

export default router