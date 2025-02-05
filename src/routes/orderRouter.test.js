const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza order", email: "reg@test.com", password: "a" };
let testUserAuthToken;

let adminUser;
let testAdminAuthToken;

const testMenuItem = { title: "test", description: "Veggie", price: 0.05, image: "pizza1.png" };
const testOrder = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: "Veggie", price: 0.05 }] };

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

  adminUser = await createAdminUser();
  const loginAdminRes = await request(app).put("/api/auth").send(adminUser);
  testAdminAuthToken = loginAdminRes.body.token;
  expectValidJwt(testAdminAuthToken);

  testMenuItem.title = randomName();
  testMenuItem.description = randomName() + " description";

  const createFranchise = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send({ name: randomName(), admins: [{ email: adminUser.email }] });
  expect(createFranchise.status).toBe(200);
  testOrder.franchiseId = createFranchise.body.id;

  const createStore = await request(app)
    .post(`/api/franchise/${createFranchise.body.id}/store`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send({ name: randomName(), admins: [{ email: adminUser.email }] });
  expect(createStore.status).toBe(200);
  testOrder.storeId = createStore.body.id;

  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(testMenuItem);
  expect(addMenuItemRes.status).toBe(200);
  testOrder.items[0].menuId = addMenuItemRes.body.id;
});

test("Add menu item", async () => {
  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(testMenuItem);
  expect(addMenuItemRes.status).toBe(200);
  expect(addMenuItemRes.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: testMenuItem.title })]));
});

test("get menu", async () => {
  const getMenuRes = await request(app).get("/api/order/menu");
  expect(getMenuRes.status).toBe(200);
  expect(getMenuRes.body.length).toBeGreaterThan(0);
  expect(getMenuRes.body).toEqual(expect.arrayContaining([expect.objectContaining({ title: testMenuItem.title })]));
});

test("create order", async () => {
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send({ name: randomName(), admins: [{ email: adminUser.email }] });
  expect(createFranchiseRes.status).toBe(200);

  const storeRes = await request(app)
    .post(`/api/franchise/${createFranchiseRes.body.id}/store`)
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send({ name: randomName(), admins: [{ email: adminUser.email }] });
  expect(storeRes.status).toBe(200);

  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testAdminAuthToken}`)
    .send(testMenuItem);
  expect(addMenuItemRes.status).toBe(200);

  testOrder.franchiseId = createFranchiseRes.body.id;
  testOrder.storeId = storeRes.body.id;
  testOrder.items[0].menuId = addMenuItemRes.body[0].id;

  const createOrderRes = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(testOrder);
  expect(createOrderRes.status).toBe(200);
  expect(createOrderRes.body.order).toEqual(expect.objectContaining(testOrder));
});
