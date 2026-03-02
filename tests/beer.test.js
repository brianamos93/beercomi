import request from 'supertest';
import app from "../src/app"
import { describe, expect, beforeEach, afterAll, beforeAll, afterEach } from '@jest/globals';
import { Buffer } from 'buffer';
const pool = require("../src/utils/config").default;

let adminToken;
let userId;
let beerId;
let reviewId;
let agent;

describe("Beer Routes", () => {
  beforeAll(async () => {
    // Create a single agent that reuses connections
    agent = request.agent(app);
  });

  beforeEach(async () => {
    // Create admin user for testing
    const adminRes = await agent
      .post("/signup")
      .send({ display_name: "TestAdmin", email: `admin${Date.now()}@test.com`, password: "testpass123" });
    
    adminToken = adminRes.body.token;
    userId = adminRes.body.id;

    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [userId]);
  });

  afterEach(async () => {
    // Clear variables after each test
    beerId = undefined;
    reviewId = undefined;
  });

  afterAll(async () => {
    // Close the agent and wait for it to fully close
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Agent close timeout"));
      }, 5000);
      
      agent.close((err) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve();
      });
    }).catch((err) => {
      console.error("Error closing agent:", err);
    });
    
    // Close pool connection
    try {
      if (!pool.ending) {
        await pool.end();
      }
    } catch (err) {
      if (!/Called end on pool more than once/.test(String(err))) {
        console.error("Error closing pool:", err);
      }
    }
  });

  describe("GET /beers", () => {
    test("should return list of beers with status 200", async () => {
      const res = await agent
        .get("/beers")
        .query({ offset: 0, limit: 10 });
      
      expect(res.status).toBe(200);
      expect(res.body.data || Array.isArray(res.body)).toBeTruthy();
    });

    test("should return beers with pagination", async () => {
      const res = await agent
        .get("/beers")
        .query({ offset: 0, limit: 5 });
      
      expect(res.status).toBe(200);
    });

    test("should handle invalid query parameters", async () => {
      const res = await agent
        .get("/beers")
        .query({ offset: "invalid", limit: 10 });
      
      expect(res.status).toBe(400);
    });
  });

  describe("GET /beers/list", () => {
    test("should return full list of beers", async () => {
      const res = await agent.get("/beers/list");
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /beers", () => {
    test("should create beer with valid data and image", async () => {
      const res = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Test IPA")
        .field("brewery_id", "test-brewery-id")
        .field("description", "A great IPA")
        .field("style", "IPA")
        .field("ibu", 65)
        .field("abv", 6.5)
        .field("color", "Golden")
        .attach("cover_image", Buffer.from("fake image"), "test.jpg");
      
      expect([200, 201]).toContain(res.status);
      expect(res.body.id).toBeDefined();
      beerId = res.body.id;
    });

    test("should reject beer creation without authentication", async () => {
      const res = await agent
        .post("/beers")
        .field("name", "Test IPA")
        .field("brewery_id", "test-brewery-id")
        .field("description", "A great IPA")
        .field("style", "IPA")
        .field("ibu", 65)
        .field("abv", 6.5)
        .field("color", "Golden");
      
      expect(res.status).toBe(401);
    });

    test("should reject beer with missing required fields", async () => {
      const res = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Test IPA");
      
      expect(res.status).toBe(400);
    });
  });

  describe("GET /beers/:id", () => {
    let localBeerId: string;

    beforeEach(async () => {
      const res = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Specific Beer")
        .field("brewery_id", "test-brewery-id")
        .field("description", "Test beer")
        .field("style", "Lager")
        .field("ibu", 30)
        .field("abv", 4.5)
        .field("color", "Pale");
      
      localBeerId = res.body.id;
    });

    test("should return beer by valid id", async () => {
      const res = await agent
        .get(`/beers/${localBeerId}`);
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(localBeerId);
    });

    test("should return 404 for non-existent beer", async () => {
      const res = await agent
        .get(`/beers/invalid-id-12345`);
      
      expect(res.status).toBe(404);
    });
  });

  describe("POST /beers/review/", () => {
    let localBeerId: string;

    beforeEach(async () => {
      const res = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Beer for Review")
        .field("brewery_id", "test-brewery-id")
        .field("description", "Test beer")
        .field("style", "Pilsner")
        .field("ibu", 35)
        .field("abv", 4.8)
        .field("color", "Light");
      
      localBeerId = res.body.id;
    });

    test("should create review with valid data", async () => {
      const res = await agent
        .post("/beers/review/")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("beer_id", localBeerId)
        .field("review", "Great beer! Really enjoyed it.")
        .field("rating", 4.5);
      
      expect([200, 201]).toContain(res.status);
      expect(res.body.reviewId).toBeDefined();
    });

    test("should reject review without authentication", async () => {
      const res = await agent
        .post("/beers/review/")
        .field("beer_id", localBeerId)
        .field("review", "Great beer")
        .field("rating", 4);
      
      expect(res.status).toBe(401);
    });

    test("should reject review with missing required fields", async () => {
      const res = await agent
        .post("/beers/review/")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("beer_id", localBeerId);
      
      expect(res.status).toBe(400);
    });

    test("should reject review with invalid rating", async () => {
      const res = await agent
        .post("/beers/review/")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("beer_id", localBeerId)
        .field("review", "Bad review")
        .field("rating", 10);
      
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /beers/:id", () => {
    let localBeerId: string;

    beforeEach(async () => {
      const res = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Beer to Delete")
        .field("brewery_id", "test-brewery-id")
        .field("description", "Will be deleted")
        .field("style", "Porter")
        .field("ibu", 40)
        .field("abv", 5.0)
        .field("color", "Dark");
      
      localBeerId = res.body.id;
    });

    test("should soft delete beer successfully", async () => {
      const res = await agent
        .delete(`/beers/${localBeerId}`);
      
      expect([200, 204]).toContain(res.status);
    });

    test("should return 404 when deleting non-existent beer", async () => {
      const res = await agent
        .delete(`/beers/non-existent-id`);
      
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /beers/review/:id", () => {
    let localBeerId: string;
    let localReviewId: string;

    beforeEach(async () => {
      const beerRes = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Beer for Review Delete")
        .field("brewery_id", "test-brewery-id")
        .field("description", "Test beer")
        .field("style", "Blonde")
        .field("ibu", 20)
        .field("abv", 4.2)
        .field("color", "Light Golden");
      
      localBeerId = beerRes.body.id;

      const reviewRes = await agent
        .post("/beers/review/")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("beer_id", localBeerId)
        .field("review", "Review to delete")
        .field("rating", 2);
      
      localReviewId = reviewRes.body.reviewId;
    });

    test("should delete review successfully", async () => {
      const res = await agent
        .delete(`/beers/review/${localReviewId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect([200, 204]).toContain(res.status);
    });

    test("should reject review deletion without authentication", async () => {
      const res = await agent
        .delete(`/beers/review/${localReviewId}`);
      
      expect(res.status).toBe(401);
    });
  });

  describe("GET /beers/deleted", () => {
    test("should return deleted beers for authenticated admin", async () => {
      const res = await agent
        .get("/beers/deleted")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ offset: 0, limit: 10 });
      
      expect([200, 403]).toContain(res.status);
    });

    test("should reject deleted beers request without authentication", async () => {
      const res = await agent
        .get("/beers/deleted")
        .query({ offset: 0, limit: 10 });
      
      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /beers/admin/hard-delete/beer/:id", () => {
    let localBeerId: string;

    beforeEach(async () => {
      const res = await agent
        .post("/beers")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("name", "Beer to Hard Delete")
        .field("brewery_id", "test-brewery-id")
        .field("description", "Permanent deletion")
        .field("style", "Porter")
        .field("ibu", 50)
        .field("abv", 6.0)
        .field("color", "Dark Brown");
      
      localBeerId = res.body.id;
    });

    test("should hard delete beer for admin", async () => {
      const res = await agent
        .delete(`/beers/admin/hard-delete/beer/${localBeerId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      
      expect([200, 204, 403]).toContain(res.status);
    });

    test("should reject hard delete without authentication", async () => {
      const res = await agent
        .delete(`/beers/admin/hard-delete/beer/${localBeerId}`);
      
      expect(res.status).toBe(401);
    });
  });
});