const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza auth", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testUserId;

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
  expectValidJwt(testUserAuthToken);
});

test("register fail", async () => {
  const registerRes = await request(app).post("/api/auth");
  expect(registerRes.status).toBe(400);
});

test("login success", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("update successs", async () => {
  const updateRes = await request(app)
    .put(`/api/auth/${testUserId}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testUser);
  expect(updateRes.status).toBe(200);
});

test("update fail", async () => {
  const updateRes = await request(app)
    .put(`/api/auth/${testUserId + 1}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testUser);
  expect(updateRes.status).toBe(403);
});

test("logout success", async () => {
  const logoutRes = await request(app).delete("/api/auth").set("Authorization", `Bearer ${testUserAuthToken}`);
  expect(logoutRes.status).toBe(200);
});

test("logout fail", async () => {
  const logoutRes = await request(app).delete("/api/auth");
  expect(logoutRes.status).toBe(401);
});
