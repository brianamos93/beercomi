import request from 'supertest';
import app from "../src/app"
import { beforeAll, describe, expect } from '@jest/globals';

beforeAll(async () => {
  const res = await request(app)
    .post("/login")
    .send({ email: "admin@admin.com", password: "admin" })

  if (!res.body || !res.body.token) {
    throw new Error("Login failed - no token returned")
  }

  globalThis.token = res.body.token
})

describe("GET /", () => {
  test("Check: running string", async () => {
    const res = await request(app).get("/")
    expect(res.body.error).toBe("unknown endpoint")
  })
})

describe("POST /beers", () => {
  test("Check: beer", async () => {
describe("POST /beers", () => {
  test("Check: beer", async () => {
    const res = await request(app).post("/beers")
    expect(res.body.token).toBeDefined()
  })
})