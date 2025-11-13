import request from 'supertest';
import app from "../src/app"
import { describe, expect } from '@jest/globals';

describe("brewery", () => {
	test("Post", async () => {
		const res = await request(app).post("/brewery")
	})
})