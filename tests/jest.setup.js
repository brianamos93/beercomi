import app from '../src/app'
import request from "supertest";
const pool = require("../src/utils/config").default;

beforeAll(async () => {
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE;");

  const res = await request(app)
    .post("/signup")
    .send({ display_name: "Admin", email: "admin@example.com", password: "secret" });

  // Promote to admin
  await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [res.body.id]);
});

afterAll(async () => {
  try {
    if (!pool.ending) {
      await pool.end();
    }
  } catch (err) {
    if (!/Called end on pool more than once/.test(String(err))) {
      throw err;
    }
  }
});