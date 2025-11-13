// beercomi/dataSeeding/seeder.js
require('dotenv').config();
const { faker } = require('@faker-js/faker');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  connectionString: process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

async function main() {
  await client.connect();
  console.log("🌱 Starting data seed...");

  // Optional: wipe existing data
  await client.query('TRUNCATE beer_reviews, beers, breweries, users RESTART IDENTITY CASCADE');
  console.log("🧹 Cleared existing data");

  // how many to create
  const NUM_USERS = 50;
  const NUM_BREWERIES = 100;
  const BEERS_PER_BREWERY = 20;
  const REVIEWS_PER_USER = 6;

  // ===== USERS =====
  console.log("👤 Creating users...");
  const users = [];
  for (let i = 0; i < NUM_USERS; i++) {
    const email = faker.internet.email();
    const passwordHash = await bcrypt.hash('password123', 10);
    const display_name = faker.internet.username().slice(0, 15);
    const res = await client.query(
      `INSERT INTO users(email, password, display_name)
       VALUES($1, $2, $3)
       RETURNING *`,
      [email, passwordHash, display_name]
    );
    users.push(res.rows[0]);
  }

  // ===== BREWERIES =====
  console.log("🏭 Creating breweries...");
  const breweries = [];
  for (let i = 0; i < NUM_BREWERIES; i++) {
    const name = faker.company.name() + " Brewing Co.";
    const location = faker.location.city() + ", " + faker.location.country();
    const date_of_founding = faker.date.past({ years: 50 });
    const author = faker.helpers.arrayElement(users);

    const res = await client.query(
      `INSERT INTO breweries (name, location, date_of_founding, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, location, date_of_founding, author.id]
    );
    breweries.push(res.rows[0]);
  }

  // ===== BEERS =====
  console.log("🍺 Creating beers...");
  const beers = [];
  for (const brewery of breweries) {
    for (let i = 0; i < BEERS_PER_BREWERY; i++) {
      const name = faker.commerce.productAdjective() + " " + faker.word.noun();
      const description = faker.lorem.sentences({ min: 1, max: 3 });
      const style = faker.helpers.arrayElement(["IPA", "Stout", "Lager", "Pilsner", "Porter", "Saison"]);
      const ibu = faker.number.int({ min: 10, max: 90 });
      const abv = faker.number.float({ min: 3, max: 12, precision: 0.1 });
      const color = faker.helpers.arrayElement(["Pale", "Amber", "Brown", "Black", "Golden"]);
      const author = faker.helpers.arrayElement(users);
      const res = await client.query(
        `INSERT INTO beers (name, brewery_id, description, style, ibu, abv, color, author_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, brewery.id, description, style, ibu, abv, color, author.id]
      );
      beers.push(res.rows[0]);
    }
  }

  // ===== BEER REVIEWS =====
  console.log("📝 Creating beer reviews...");
  for (const user of users) {
    for (let i = 0; i < REVIEWS_PER_USER; i++) {
      const beer = faker.helpers.arrayElement(beers);
      const rating = faker.number.int({ min: 1, max: 5 });
      const review = faker.lorem.sentences({ min: 1, max: 4 });

      await client.query(
        `INSERT INTO beer_reviews (author_id, beer_id, rating, review)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [user.id, beer.id, rating, review]
      );
    }
  }

  console.log("✅ Seeding complete!");
  await client.end();
}

main().catch(err => {
  console.error("❌ Seeder error:", err);
  process.exit(1);
});
