process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');

let mongod;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const future = (days = 3) => new Date(Date.now() + days * 86400000).toISOString();

async function registerPatient(name, email) {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123' });
  return res.body.token;
}
async function login(email, password = 'password123') {
  return (await request(app).post('/api/auth/login').send({ email, password })).body.token;
}
async function makeStaff(role, email, name = role) {
  await User.create({ name, email, role, specialty: role === 'doctor' ? 'Cardiology' : undefined, passwordHash: await bcrypt.hash('password123', 4) });
  return login(email);
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

describe('authentication', () => {
  test('register returns token and creates a patient', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Ann', email: 'ann@x.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('patient');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('register cannot self-assign admin role', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Eve', email: 'eve@x.com', password: 'password123', role: 'admin' });
    expect(res.body.user.role).toBe('patient');
  });

  test('register validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(3);
  });

  test('duplicate email -> 409', async () => {
    await registerPatient('Ann', 'ann@x.com');
    const res = await request(app).post('/api/auth/register').send({ name: 'Ann2', email: 'ann@x.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  test('login success and failure', async () => {
    await registerPatient('Ann', 'ann@x.com');
    expect((await request(app).post('/api/auth/login').send({ email: 'ann@x.com', password: 'password123' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'ann@x.com', password: 'wrongpass1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'ghost@x.com', password: 'password123' })).status).toBe(401);
  });

  test('protected routes need a valid token', async () => {
    expect((await request(app).get('/api/patients')).status).toBe(401);
    expect((await request(app).get('/api/patients').set(auth('garbage'))).status).toBe(401);
  });

  test('malformed JSON -> 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('role-based authorization', () => {
  test('patient cannot list patients; doctor and admin can', async () => {
    const p = await registerPatient('Ann', 'ann@x.com');
    const d = await makeStaff('doctor', 'doc@x.com');
    const a = await makeStaff('admin', 'admin@x.com');
    expect((await request(app).get('/api/patients').set(auth(p))).status).toBe(403);
    expect((await request(app).get('/api/patients').set(auth(d))).status).toBe(200);
    expect((await request(app).get('/api/patients').set(auth(a))).status).toBe(200);
  });

  test('patient can read only their own record', async () => {
    const p1 = await registerPatient('Ann', 'ann@x.com');
    const p2 = await registerPatient('Bob', 'bob@x.com');
    const d = await makeStaff('doctor', 'doc@x.com');
    const bob = (await request(app).get('/api/patients').set(auth(d))).body.find((x) => x.name === 'Bob');
    expect((await request(app).get(`/api/patients/${bob._id}`).set(auth(p1))).status).toBe(403);
    expect((await request(app).get(`/api/patients/${bob._id}`).set(auth(p2))).status).toBe(200);
    expect((await request(app).get('/api/patients/me').set(auth(p2))).body.name).toBe('Bob');
  });

  test('only admin can create staff', async () => {
    const p = await registerPatient('Ann', 'ann@x.com');
    const a = await makeStaff('admin', 'admin@x.com');
    const body = { name: 'Dr Who', email: 'who@x.com', password: 'password123', role: 'doctor', specialty: 'ENT' };
    expect((await request(app).post('/api/users').set(auth(p)).send(body)).status).toBe(403);
    expect((await request(app).post('/api/users').set(auth(a)).send(body)).status).toBe(201);
    expect((await request(app).get('/api/users/doctors').set(auth(p))).body).toHaveLength(1);
  });

  test('only doctors add notes; patients see them', async () => {
    const p = await registerPatient('Ann', 'ann@x.com');
    const d = await makeStaff('doctor', 'doc@x.com');
    const a = await makeStaff('admin', 'admin@x.com');
    const me = (await request(app).get('/api/patients/me').set(auth(p))).body;
    expect((await request(app).post(`/api/patients/${me._id}/notes`).set(auth(a)).send({ text: 'x' })).status).toBe(403);
    expect((await request(app).post(`/api/patients/${me._id}/notes`).set(auth(d)).send({ text: 'Blood pressure normal' })).status).toBe(201);
    expect((await request(app).get('/api/patients/me').set(auth(p))).body.notes[0].text).toBe('Blood pressure normal');
  });

  test('invalid ObjectId -> 400', async () => {
    const d = await makeStaff('doctor', 'doc@x.com');
    expect((await request(app).get('/api/patients/not-an-id').set(auth(d))).status).toBe(400);
  });
});

describe('appointments', () => {
  async function setup() {
    const p = await registerPatient('Ann', 'ann@x.com');
    const d = await makeStaff('doctor', 'doc@x.com', 'Dr Doc');
    const doctorId = (await request(app).get('/api/users/doctors').set(auth(p))).body[0].id;
    return { p, d, doctorId };
  }

  test('patient books; doctor sees it; patient cannot book in the past', async () => {
    const { p, d, doctorId } = await setup();
    const ok = await request(app).post('/api/appointments').set(auth(p)).send({ doctorId, scheduledAt: future(), reason: 'Checkup' });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('scheduled');
    expect((await request(app).get('/api/appointments').set(auth(d))).body).toHaveLength(1);
    const past = await request(app).post('/api/appointments').set(auth(p)).send({ doctorId, scheduledAt: '2020-01-01T10:00:00Z', reason: 'Old' });
    expect(past.status).toBe(400);
  });

  test('double booking the same slot -> 409, but allowed after cancellation', async () => {
    const { p, doctorId } = await setup();
    const p2 = await registerPatient('Bob', 'bob@x.com');
    const when = future();
    const first = await request(app).post('/api/appointments').set(auth(p)).send({ doctorId, scheduledAt: when, reason: 'Checkup' });
    expect((await request(app).post('/api/appointments').set(auth(p2)).send({ doctorId, scheduledAt: when, reason: 'Other' })).status).toBe(409);
    await request(app).patch(`/api/appointments/${first.body._id}/status`).set(auth(p)).send({ status: 'cancelled' });
    expect((await request(app).post('/api/appointments').set(auth(p2)).send({ doctorId, scheduledAt: when, reason: 'Other' })).status).toBe(201);
  });

  test('status permissions: patient may only cancel; other doctors/patients are blocked', async () => {
    const { p, d, doctorId } = await setup();
    const other = await registerPatient('Bob', 'bob@x.com');
    const otherDoc = await makeStaff('doctor', 'doc2@x.com');
    const appt = (await request(app).post('/api/appointments').set(auth(p)).send({ doctorId, scheduledAt: future(), reason: 'Checkup' })).body;
    const url = `/api/appointments/${appt._id}/status`;
    expect((await request(app).patch(url).set(auth(p)).send({ status: 'completed' })).status).toBe(403);
    expect((await request(app).patch(url).set(auth(other)).send({ status: 'cancelled' })).status).toBe(403);
    expect((await request(app).patch(url).set(auth(otherDoc)).send({ status: 'completed' })).status).toBe(403);
    expect((await request(app).patch(url).set(auth(d)).send({ status: 'completed' })).status).toBe(200);
    expect((await request(app).patch(url).set(auth(d)).send({ status: 'cancelled' })).status).toBe(409);
  });

  test('doctors cannot book; unknown doctor -> 404', async () => {
    const { p, d, doctorId } = await setup();
    expect((await request(app).post('/api/appointments').set(auth(d)).send({ doctorId, scheduledAt: future(), reason: 'x y z' })).status).toBe(403);
    const fake = new mongoose.Types.ObjectId().toString();
    expect((await request(app).post('/api/appointments').set(auth(p)).send({ doctorId: fake, scheduledAt: future(), reason: 'Checkup' })).status).toBe(404);
  });
});
