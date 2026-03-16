// beercomi/dataSeeding/seeder.js

require("dotenv").config();
const { faker } = require("@faker-js/faker");
const { Client } = require("pg");
const bcrypt = require("bcrypt");

const client = new Client({
  connectionString:
    process.env.DB_URL ||
    "postgresql://backend_user:npg_Uw3dZhDRsxm9@ep-lively-meadow-a1liwp2s-pooler.ap-southeast-1.aws.neon.tech/beercomi?sslmode=require",
});

/* ---------------- CONFIG ---------------- */

const NUM_USERS = 100;
const NUM_BREWERIES = 150;
const BEERS_PER_BREWERY = 12;
const REVIEWS_PER_USER = 10;

/* ---------------- DATASETS ---------------- */

const BEER_STYLES = [
  { name: "American IPA", abv: [5.5, 7.5], ibu: [40, 70], color: "Amber" },
  { name: "Double IPA", abv: [7.5, 10], ibu: [60, 100], color: "Golden" },
  { name: "Imperial Stout", abv: [8, 12], ibu: [50, 90], color: "Black" },
  { name: "Dry Stout", abv: [4, 5], ibu: [30, 45], color: "Black" },
  { name: "Pilsner", abv: [4.5, 5.5], ibu: [20, 40], color: "Pale" },
  { name: "Helles Lager", abv: [4.7, 5.4], ibu: [16, 22], color: "Golden" },
  { name: "Belgian Tripel", abv: [7.5, 9.5], ibu: [20, 40], color: "Golden" },
  { name: "Saison", abv: [5, 7], ibu: [20, 35], color: "Amber" },
  { name: "Porter", abv: [5, 6.5], ibu: [25, 50], color: "Brown" },
];

const BREWERY_SUFFIXES = [
  "Brewing",
  "Brewing Co.",
  "Craft Brewery",
  "Beer Company",
  "Brew Works",
];

const BEER_NAME_PARTS = [
  "River","Mountain","Fog","Oak","Iron",
  "Golden","Midnight","Hazy","Old Town","Sunset",
];

/* ---------------- IMAGE HELPERS ---------------- */

function breweryCoverImage() {
  return `https://loremflickr.com/800/600/brewery,building?lock=${faker.number.int(100000)}`;
}

function beerCoverImage() {
  return `https://loremflickr.com/800/600/craft-beer?lock=${faker.number.int(100000)}`;
}

function reviewPhotoImage() {
  return `https://loremflickr.com/800/600/beer,glass?lock=${faker.number.int(100000)}`;
}

/* ---------------- HELPERS ---------------- */

function generateBeerName() {
  const part = faker.helpers.arrayElement(BEER_NAME_PARTS);
  const suffix = faker.helpers.arrayElement([
    "IPA","Ale","Lager","Stout","Reserve","Special"
  ]);
  return `${part} ${suffix}`;
}

function randomABV(min, max) {
  return Math.round(
    faker.number.float({ min, max }) * 10
  );
}

function weightedRating() {
  return faker.helpers.weightedArrayElement([
    { weight: 5, value: 5 },
    { weight: 4, value: 4 },
    { weight: 3, value: 3 },
    { weight: 1, value: 2 },
    { weight: 1, value: 1 },
  ]);
}

/* ---------------- MAIN ---------------- */

async function main() {

  await client.connect();

  console.log("🌱 Starting seed...");

  await client.query("BEGIN");

  try {

    await client.query(`
      TRUNCATE review_photos, beer_reviews, beers, breweries, users
      RESTART IDENTITY CASCADE
    `);

    /* ---------- USERS ---------- */

    console.log("👤 Creating users...");

    const userValues = [];
    const userPlaceholders = [];

    const adminPassword = await bcrypt.hash("admin12345", 10);

    userPlaceholders.push("($1,$2,$3,$4)");
    userValues.push("admin@admin.com", adminPassword, "admin", "admin");

    let param = 5;

    for (let i = 0; i < NUM_USERS; i++) {

      const email = faker.internet.email();
      const password = await bcrypt.hash("password123", 10);
      const display = faker.internet.username().slice(0,15);

      userPlaceholders.push(`($${param},$${param+1},$${param+2},'basic')`);

      userValues.push(email,password,display);

      param += 3;
    }

    const usersRes = await client.query(
      `INSERT INTO users (email,password,display_name,role)
       VALUES ${userPlaceholders.join(",")}
       RETURNING *`,
      userValues
    );

    const users = usersRes.rows;

    /* ---------- BREWERIES ---------- */

    console.log("🏭 Creating breweries...");

    const breweryValues=[];
    const breweryPlaceholders=[];

    param=1;

    for (let i=0;i<NUM_BREWERIES;i++){

      const name =
        faker.location.city()+" "+
        faker.helpers.arrayElement(BREWERY_SUFFIXES);

      const location =
        faker.location.city()+", "+
        faker.location.country();

      const founded = faker.date.past({years:50}).getFullYear();
      const author = faker.helpers.arrayElement(users);

      breweryPlaceholders.push(
        `($${param},$${param+1},$${param+2},$${param+3},$${param+4})`
      );

      breweryValues.push(
        name,
        location,
        founded,
        author.id,
        breweryCoverImage()
      );

      param+=5;
    }

    const breweriesRes = await client.query(
      `INSERT INTO breweries
      (name,location,date_of_founding,author_id,cover_image)
      VALUES ${breweryPlaceholders.join(",")}
      RETURNING *`,
      breweryValues
    );

    const breweries = breweriesRes.rows;

    /* ---------- BEERS ---------- */

    console.log("🍺 Creating beers...");

    const beerValues=[];
    const beerPlaceholders=[];

    param=1;

    for (const brewery of breweries){

      for (let i=0;i<BEERS_PER_BREWERY;i++){

        const style=faker.helpers.arrayElement(BEER_STYLES);

        beerPlaceholders.push(
          `($${param},$${param+1},$${param+2},$${param+3},$${param+4},$${param+5},$${param+6},$${param+7},$${param+8})`
        );

        beerValues.push(
          generateBeerName(),
          brewery.id,
          faker.lorem.sentences({min:1,max:3}),
          style.name,
          faker.number.int({min:style.ibu[0],max:style.ibu[1]}),
          randomABV(style.abv[0],style.abv[1]),
          style.color,
          faker.helpers.arrayElement(users).id,
          beerCoverImage()
        );

        param+=9;
      }
    }

    const beersRes = await client.query(
      `INSERT INTO beers
      (name,brewery_id,description,style,ibu,abv,color,author_id,cover_image)
      VALUES ${beerPlaceholders.join(",")}
      RETURNING *`,
      beerValues
    );

    const beers = beersRes.rows;

    /* ---------- REVIEWS ---------- */

    console.log("📝 Creating reviews...");

    const reviewValues=[];
    const reviewPlaceholders=[];

    param=1;

    for (const user of users){

      for (let i=0;i<REVIEWS_PER_USER;i++){

        const beer=faker.helpers.arrayElement(beers);

        reviewPlaceholders.push(
          `($${param},$${param+1},$${param+2},$${param+3})`
        );

        reviewValues.push(
          user.id,
          beer.id,
          faker.lorem.sentences({min:1,max:4}),
          weightedRating()
        );

        param+=4;
      }
    }

    const reviewRes = await client.query(
      `INSERT INTO beer_reviews
       (author_id,beer_id,review,rating)
       VALUES ${reviewPlaceholders.join(",")}
       ON CONFLICT (author_id,beer_id) DO NOTHING
       RETURNING id, author_id`,
      reviewValues
    );

    const reviews = reviewRes.rows;

    /* ---------- REVIEW PHOTOS ---------- */

    console.log("📸 Creating review photos...");

    const photoValues=[];
    const photoPlaceholders=[];

    param=1;

    for (const review of reviews){

      const photoCount = faker.number.int({min:0,max:3});

      for (let i=0;i<photoCount;i++){

        photoPlaceholders.push(
          `($${param},$${param+1},$${param+2},$${param+3})`
        );

        photoValues.push(
          review.author_id,
          review.id,
          reviewPhotoImage(),
          i+1
        );

        param+=4;
      }
    }

    if(photoValues.length>0){

      await client.query(
        `INSERT INTO review_photos
        (user_id,review_id,photo_url,position)
        VALUES ${photoPlaceholders.join(",")}`,
        photoValues
      );

    }

    await client.query("COMMIT");

    console.log("✅ Seeding complete!");

  } catch(err){

    await client.query("ROLLBACK");

    console.error("❌ Seeder error:",err);

  }

  await client.end();
}

main();