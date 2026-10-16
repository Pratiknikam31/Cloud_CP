import request from 'supertest';
import { setupTestTable, teardownTestTable } from './helpers/dynamoLocal';
import type { Application } from 'express';

let app: Application;
let table: string;
let seedModule: typeof import('../src/seeders/seed');
let dynamo: typeof import('../src/db/dynamo');
let keys: typeof import('../src/db/keys');

beforeAll(async () => {
  table = await setupTestTable();
  seedModule = await import('../src/seeders/seed');
  dynamo = await import('../src/db/dynamo');
  keys = await import('../src/db/keys');
  app = (await import('../src/app')).default;
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await seedModule.seed();
}, 120000);
afterAll(async () => {
  jest.restoreAllMocks();
  await teardownTestTable(table);
});

const login = async (email: string) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  expect(res.status).toBe(200);
  return res.body.token as string;
};

describe('demo seeder', () => {
  it('lets the demo admin log in', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@smarthospital.org', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: 'admin@smarthospital.org', role: 'hospital_admin' });
  });

  it('lets all 10 demo accounts log in', async () => {
    const emails = ['admin', 'doctor', 'brody', 'patient', 'maria', 'david', 'reception', 'lab', 'pharmacy', 'nurse'];
    for (const e of emails) await login(`${e}@smarthospital.org`);
  });

  it("returns the demo patient's seeded appointment with populated doctor", async () => {
    const token = await login('patient@smarthospital.org');
    const res = await request(app).get('/api/appointments').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.appointments).toHaveLength(1);
    const appt = res.body.appointments[0];
    expect(appt.appointmentId).toMatch(/^APT-\d{4}-\d{5}$/);
    expect(appt.status).toBe('in_consultation');
    expect(appt.queueNumber).toBe(1);
    expect(appt.slotLock).toBeUndefined();
    expect(appt.doctor).toMatchObject({ name: 'Dr. Eleanor Vance', specialization: 'Interventional Cardiology' });
    expect(appt.doctor.doctorId).toMatch(/^D-\d{4}-\d{4}$/);
    expect(appt.doctor.department).toMatchObject({ name: 'Cardiology', code: 'CARD' });
    expect(appt.patient).toMatchObject({ name: 'Robert Chen' });
    expect(appt.patient.patientId).toMatch(/^P-\d{4}-\d{4}$/);
  });

  it('keeps aggregates, guards and slot locks consistent', async () => {
    const totals = await dynamo.getItem(keys.STATS.totals.PK, keys.STATS.totals.SK);
    expect(totals).toMatchObject({ patients: 3, appointments: 3 });

    const billing = await dynamo.getItem(keys.STATS.billing.PK, keys.STATS.billing.SK);
    expect(billing).toMatchObject({ totalBilled: 419, totalPaid: 234, totalBalance: 185, count: 2, count_paid: 1, count_pending: 1 });

    const boot = await dynamo.getItem(keys.STATS.auditAction('SYSTEM_BOOT').PK, keys.STATS.auditAction('SYSTEM_BOOT').SK);
    expect(boot?.count).toBe(1);

    for (const [kind, value] of [['DEPTNAME', 'Cardiology'], ['DEPTCODE', 'CARD'], ['ROOM', 'ICU-101'], ['BED', 'ICU-101-A'], ['LABTEST', 'LT-LIPID'], ['EMAIL', 'nurse@smarthospital.org']] as const) {
      const guard = await dynamo.getItem(keys.uniqueKey(kind, value).PK, 'UNIQUE');
      expect(guard?.ownerId).toBeTruthy();
    }

    // The seeded slot is locked: booking the same doctor/day/slot is refused.
    const token = await login('maria@smarthospital.org');
    const mine = await request(app).get('/api/appointments').set('Authorization', `Bearer ${await login('patient@smarthospital.org')}`);
    const a = mine.body.appointments[0];
    const clash = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctor: a.doctor._id, department: a.department._id, date: a.date, timeSlot: a.timeSlot, symptoms: 'Chest pain' });
    expect(clash.status).toBe(409);
  });

  it('serves the seeded aggregates through the stats endpoints', async () => {
    const admin = await login('admin@smarthospital.org');
    const billing = await request(app).get('/api/billing/stats').set('Authorization', `Bearer ${admin}`);
    expect(billing.status).toBe(200);
    expect(billing.body.data).toEqual({ totalRevenue: 234, totalPending: 185, totalInvoices: 2, paidCount: 1, pendingCount: 1 });

    const overview = await request(app).get('/api/analytics/overview').set('Authorization', `Bearer ${admin}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data.kpis).toMatchObject({ totalPatients: 3, totalDoctors: 2, totalAppointments: 3 });
  });

  it('keeps read notifications out of the unread index', async () => {
    const doctor = await request(app).get('/api/notifications').set('Authorization', `Bearer ${await login('doctor@smarthospital.org')}`);
    expect(doctor.status).toBe(200);
    expect(doctor.body.data.notifications).toHaveLength(1);
    expect(doctor.body.data.unreadCount).toBe(0);

    const patient = await request(app).get('/api/notifications').set('Authorization', `Bearer ${await login('patient@smarthospital.org')}`);
    expect(patient.body.data.unreadCount).toBe(1);
  });

  it('leaves the ID counters ahead of the seeded IDs (no collision with new records)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New Patient', email: 'new.patient@example.com', password: 'password123', role: 'patient', phone: '+1 555-000-0000' });
    expect(res.status).toBe(201);
    const { findPatientByUser } = await import('../src/repositories/profiles');
    const profile = await findPatientByUser(res.body.user.id);
    expect(profile?.patientId).toMatch(/^P-\d{4}-0004$/);
  });

  it('sets medicine status with the createMedicine rule', async () => {
    const meds = await dynamo.queryAll({ index: 'GSI1', pk: keys.typePartition('MED') });
    const byName = Object.fromEntries(meds.map((m) => [m.name, m]));
    expect(byName['Paracetamol 650mg'].status).toBe('in_stock');
    expect(byName['Omeprazole 20mg'].status).toBe('low_stock');
    expect(new Set(meds.map((m) => m.medicineId)).size).toBe(6);
  });

  it('creates an initial stock_in ledger entry for each seeded medicine', async () => {
    const meds = await dynamo.queryAll({ index: 'GSI1', pk: keys.typePartition('MED') });
    expect(meds).toHaveLength(6);
    for (const m of meds) {
      const ledger = await dynamo.queryAll({ index: 'GSI2', pk: `MED#${m._id}` });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ type: 'stock_in', quantity: m.quantity, reason: 'Initial stock entry' });
    }
  });

  it('refuses to seed a second time', async () => {
    const before = await dynamo.getItem(keys.STATS.totals.PK, keys.STATS.totals.SK);
    await expect(seedModule.seed()).rejects.toThrow(/already present/);
    const after = await dynamo.getItem(keys.STATS.totals.PK, keys.STATS.totals.SK);
    expect(after).toEqual(before);
  });

  it('refuses in production unless SEED_ALLOW_PRODUCTION=yes', async () => {
    const before = { nodeEnv: process.env.NODE_ENV, allow: process.env.SEED_ALLOW_PRODUCTION };
    process.env.NODE_ENV = 'production';
    try {
      delete process.env.SEED_ALLOW_PRODUCTION;
      await expect(seedModule.seed()).rejects.toThrow(/production/);
      // With the override the production check passes (and the "already seeded" check refuses).
      process.env.SEED_ALLOW_PRODUCTION = 'yes';
      await expect(seedModule.seed()).rejects.toThrow(/already present/);
    } finally {
      process.env.NODE_ENV = before.nodeEnv;
      if (before.allow === undefined) delete process.env.SEED_ALLOW_PRODUCTION;
      else process.env.SEED_ALLOW_PRODUCTION = before.allow;
    }
  });
});

describe('two seeders started at the same time on an empty table', () => {
  let secondTable: string;
  afterAll(async () => {
    if (secondTable) await teardownTestTable(secondTable);
  });

  it('lets exactly one of them seed (the admin email guard decides)', async () => {
    secondTable = await setupTestTable(); // switches the app to a fresh, empty table
    const results = await Promise.allSettled([seedModule.seed(), seedModule.seed()]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    // The loser fails on the admin account, before writing anything else.
    const totals = await dynamo.getItem(keys.STATS.totals.PK, keys.STATS.totals.SK);
    expect(totals).toMatchObject({ patients: 3, appointments: 3 });
    const billing = await dynamo.getItem(keys.STATS.billing.PK, keys.STATS.billing.SK);
    expect(billing).toMatchObject({ count: 2, totalBilled: 419 });
    const meds = await dynamo.queryAll({ index: 'GSI1', pk: keys.typePartition('MED') });
    expect(meds).toHaveLength(6);
  }, 120000);
});
