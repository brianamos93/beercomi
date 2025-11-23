const request = require("supertest");
import app from '../src/app'
const pool = require("../src/utils/config").default;
const { describe, beforeAll, test, afterAll } = require("@jest/globals");


// Helpers
async function createUserAndLogin() {
  // Reset everything
  await pool.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE;");

  // Create user
  await request(app)
    .post("/signup")
    .send({
      display_name: "User1",
      email: "user@example.com",
      password: "secret"
    });

  // Login user
  const login = await request(app)
    .post("/login")
    .send({
      email: "user@example.com",
      password: "secret"
    });

  return login.body; // expecting { token: "...", user: {...} }
}

async function createBeer() {
  const beer = await pool.query(`
    INSERT INTO beers (name) VALUES ('Test Beer') RETURNING *;
  `);
  return beer.rows[0];
}

async function createBrewery() {
  const brewery = await pool.query(`
    INSERT INTO breweries (name) VALUES ('Test Brewery') RETURNING *;
  `);
  return brewery.rows[0];
}

describe("Favorites Routes", () => {
  let token;
  let beer;
  let brewery;

  beforeAll(async () => {
    await pool.query(`
      TRUNCATE TABLE 
        beers_favorites, breweries_favorites, 
        beers, breweries 
      RESTART IDENTITY CASCADE;
    `);

    const loginData = await createUserAndLogin();
    token = loginData.token;

    beer = await createBeer();
    brewery = await createBrewery();
  });

  afterAll(async () => {
    await pool.end();
  });

  // -----------------------------
  // POST /favorites
  // -----------------------------
  describe("POST /favorites", () => {
    test("Should favorite a beer", async () => {
      const res = await request(app)
        .post("/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({
          table: "beers",
          target_id: beer.id
        });

      expect(res.status).toBe(201);
      expect(res.body.beer_id).toBe(beer.id);
    });

    test("Should not duplicate a beer favorite", async () => {
      const res = await request(app)
        .post("/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({
          table: "beers",
          target_id: beer.id
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Already favorited");
    });

    test("Should favorite a brewery", async () => {
      const res = await request(app)
        .post("/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({
          table: "breweries",
          target_id: brewery.id
        });

      expect(res.status).toBe(201);
      expect(res.body.brewery_id).toBe(brewery.id);
    });

    test("Should fail if beer does not exist", async () => {
      const res = await request(app)
        .post("/favorites")
        .set("Authorization", `Bearer ${token}`)
        .send({
          table: "beers",
          target_id: "00000000-0000-0000-0000-000000000000"
        });

      expect(res.status).toBe(404);
    });
  });

  // -----------------------------
  // GET /favorites/:table
  // -----------------------------
  describe("GET /favorites/:table", () => {
    test("Should fetch beer favorites", async () => {
      const res = await request(app)
        .get("/favorites/beers")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].beer_id).toBe(beer.id);
    });

    test("Should fetch brewery favorites", async () => {
      const res = await request(app)
        .get("/favorites/breweries")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].brewery_id).toBe(brewery.id);
    });
  });

  // -----------------------------
  // DELETE /favorites/:table/:id
  // -----------------------------
  describe("DELETE /favorites/:table/:id", () => {
    let beerFavoriteId;
    let breweryFavoriteId;

    beforeAll(async () => {
      const res1 = await pool.query("SELECT id FROM beers_favorites LIMIT 1;");
      beerFavoriteId = res1.rows[0].id;

      const res2 = await pool.query("SELECT id FROM breweries_favorites LIMIT 1;");
      breweryFavoriteId = res2.rows[0].id;
    });

    test("Should delete a beer favorite", async () => {
      const res = await request(app)
        .delete(`/favorites/beers/${beerFavoriteId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);

      const check = await pool.query(
        "SELECT * FROM beers_favorites WHERE id = $1",
        [beerFavoriteId]
      );
      expect(check.rowCount).toBe(0);
    });

    test("Should delete a brewery favorite", async () => {
      const res = await request(app)
        .delete(`/favorites/breweries/${breweryFavoriteId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);

      const check = await pool.query(
        "SELECT * FROM breweries_favorites WHERE id = $1",
        [breweryFavoriteId]
      );
      expect(check.rowCount).toBe(0);
    });

    test("Should fail to delete nonexistent favorite", async () => {
      const res = await request(app)
        .delete(`/favorites/beers/00000000-0000-0000-0000-000000000000`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
