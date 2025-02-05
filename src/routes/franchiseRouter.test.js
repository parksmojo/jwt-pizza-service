const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;

let testAdminAuthToken;
let testAdminId;

const testFranchise = { name: "pizzaPocket", admins: [{ email: "a@jwt.com" }] };
const testStore = { name: "pizzaPocket", admins: [{ email: "a@jwt.com" }] };

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

async function createAdminUser() {
  let password = "toomanyscrets";
  let user = { password, roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password };
}

beforeAll(async () => {
  testUser.email = randomName() + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);

  const adminUser = await createAdminUser();
  const loginAdminRes = await request(app).put("/api/auth").send(adminUser);
  testAdminAuthToken = loginAdminRes.body.token;
  testAdminId = loginAdminRes.body.user.id;
  expectValidJwt(testAdminAuthToken);

  testFranchise.name = randomName();
  testFranchise.admins[0].email = adminUser.email;

  testStore.name = randomName();
  testStore.admins[0].email = adminUser.email;

  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(testFranchise);
  expect(createRes.status).toBe(200);
  testFranchise.id = createRes.body.id;

  const storeRes = await request(app)
    .post(`/api/franchise/${testFranchise.id}/store`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(testStore);
  expect(storeRes.status).toBe(200);
  testStore.id = storeRes.body.id;
});

test("create franchise fail", async () => {
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testFranchise);
  expect(createRes.status).toBe(403);
});

test("create franchise success", async () => {
  const newFranchise = { ...testFranchise, name: randomName() };
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(newFranchise);
  expect(createRes.status).toBe(200);
  expect(createRes.body).toEqual(expect.objectContaining({ name: newFranchise.name }));
});

test("get franchises", async () => {
  const res = await request(app).get("/api/franchise");
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
  expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ name: testFranchise.name })]));
});

test("get user franchises", async () => {
  const res = await request(app)
    .get(`/api/franchise/${testAdminId}`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
});

test("delete franchise success", async () => {
  const deleteFranchise = { ...testFranchise, name: randomName() };
  const createRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(deleteFranchise);
  expect(createRes.status).toBe(200);
  expect(createRes.body).toEqual(expect.objectContaining({ name: deleteFranchise.name }));

  const deleteRes = await request(app)
    .delete(`/api/franchise/${createRes.body.id}`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(deleteRes.status).toBe(200);
});

test("create store success", async () => {
  const newStore = { ...testStore, name: randomName() };
  const storeRes = await request(app)
    .post(`/api/franchise/${testFranchise.id}/store`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(newStore);
  expect(storeRes.status).toBe(200);
  expect(storeRes.body).toEqual(expect.objectContaining({ name: newStore.name }));
});

test("delete store success", async () => {
  const deleteRes = await request(app)
    .delete(`/api/franchise/${testFranchise.id}/store/${testStore.id}`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`);
  expect(deleteRes.status).toBe(200);
});
