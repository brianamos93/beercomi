import dotenv from "dotenv";
import pg from "pg";

if (process.env.NODE_ENV === "test") {
  dotenv.config({ path: ".env.test" });
} else {
  dotenv.config();
}

const pool = new pg.Pool({
  connectionString: process.env.DB_URL,
});

export default pool;
