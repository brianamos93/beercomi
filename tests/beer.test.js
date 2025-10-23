import request from 'supertest';
import app from "../src/app"
import { describe, expect } from '@jest/globals';

describe("GET /", () => {
  test("Check: running string", async () => {
    const res = await request(app).get("/")
    expect(res.body.error).toBe("unknown endpoint")
  })
})