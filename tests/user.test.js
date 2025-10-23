const { describe, beforeAll, test, afterAll } = require("@jest/globals");
const supertest = require("supertest");
const app = require("../src/app")
const api = supertest(app)
const path = require("path");


describe("when a new user signs up", () => {
  test("POST /signup 201", async () => {
    const newUser = {
      display_name: "testuser",
      email: "test@test.com",
      password: "test"
    }
    await api
      .post("/signup")
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/)

  })

  test("POST /signup 500", async () => {
    const newUser = {
      display_name: "testuser",
      email: "test@test.com",
      password: "test"
    }
    await api
      .post("/signup")
      .send(newUser)
      .expect(500)
      .expect('Content-Type', /application\/json/)
  })

  test("POST /signup 500", async () => {
    const newUser = {
      display_name: "testuser",
      email: "test4@test.com",
      password: "test"
    }
    await api
      .post("/signup")
      .send(newUser)
      .expect(500)
      .expect('Content-Type', /application\/json/)
  })

})

describe("Login and test profile image", () => {
  let token = ""

  test("Login 401", async () => {
    const loginInfo = {
      email: "admi@example.com",
      password: "scret"
    }
    await api
      .post("/login")
      .send(loginInfo)
      .expect(401)
      .expect("Content-Type", /application\/json/);

  })
  test("Login 200", async () => {
    const loginInfo = {
      email: "admin@example.com",
      password: "secret"
    }
    const response = await api
      .post("/login")
      .send(loginInfo)
      .expect(200)
      .expect("Content-Type", /application\/json/);

    token = response.body.token;

  })
  test("Upload Profile Image", async () => {
    const filePath = path.join(__dirname, "uploadFiles", "avatar.png");
    await api
      .post("/profile/img/upload")
      .set('Authorization', `Bearer ${token}`)
      .attach('image', filePath)
      .expect(200)
  })

    test("Upload Profile Image no file 400", async () => {
    await api
      .post("/profile/img/upload")
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })

    test("Upload Profile Image Change Image", async () => {
    const filePath = path.join(__dirname, "uploadFiles", "avatar2.png");
    await api
      .post("/profile/img/upload")
      .set('Authorization', `Bearer ${token}`)
      .attach('image', filePath)
      .expect(200)
  })

    test("Upload Profile Image", async () => {
    const filePath = path.join(__dirname, "uploadFiles", "avatar.png");
    await api
      .post("/profile/img/upload")
      .set('Authorization', `Bearer ${token}`)
      .attach('image', filePath)
      .expect(200)
  })

    test("Delete uploaded profile image", async () => {
    await api
      .delete("/profile/img/")
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })
})