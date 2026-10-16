import request from 'supertest';
import { setupTestTable, teardownTestTable } from './helpers/dynamoLocal';
import { makeDepartment, makeDoctor, makePatient, makeUser } from './helpers/factory';
import type { Application } from 'express';

let app: Application;
let table: string;
let admin: string;
let receptionist: string;

beforeAll(async () => {
  table = await setupTestTable();
  app = (await import('../src/app')).default;
  admin = (await makeUser('admin', { name: 'Admin Ann' })).token;
  receptionist = (await makeUser('receptionist')).token;
});
afterAll(() => teardownTestTable(table));

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const createRoom = (roomNumber: string, roomType = 'general') =>
  request(app).post('/api/beds/rooms').set(auth(admin)).send({ roomNumber, building: 'Main', floor: '1', roomType, ratePerDay: 100 });

const createBed = (bedNumber: string, room: string) =>
  request(app).post('/api/beds/beds').set(auth(admin)).send({ bedNumber, room });

describe('rooms and beds', () => {
  it('creates rooms and beds, enforces unique numbers and lists with stats', async () => {
    const r1 = await createRoom('R-101', 'icu');
    expect(r1.status).toBe(201);
    const room = r1.body.data.room;
    expect(room).toMatchObject({ roomNumber: 'R-101', roomType: 'icu' });
    expect(room.PK).toBeUndefined();

    const dup = await createRoom('r-101');
    expect(dup.status).toBe(409);

    const b1 = await createBed('B-1', room._id);
    expect(b1.status).toBe(201);
    expect(b1.body.data.bed.status).toBe('available');
    expect(b1.body.data.bed.room).toMatchObject({ _id: room._id, roomNumber: 'R-101' });
    expect((await createBed('B-1', room._id)).status).toBe(409);
    expect((await createBed('B-X', 'no-such-room')).status).toBe(404);
    await createBed('B-2', room._id);

    const other = (await createRoom('R-102', 'general')).body.data.room;
    await createBed('B-3', other._id);

    const rooms = await request(app).get('/api/beds/rooms').set(auth(receptionist));
    expect(rooms.body.data.rooms.map((r: any) => r.roomNumber)).toEqual(['R-101', 'R-102']);

    const all = await request(app).get('/api/beds/beds').set(auth(receptionist));
    expect(all.status).toBe(200);
    expect(all.body.data.beds.map((b: any) => b.bedNumber)).toEqual(['B-1', 'B-2', 'B-3']);
    expect(all.body.data.stats).toEqual({ totalBeds: 3, occupied: 0, available: 3, reserved: 0, maintenance: 0, occupancyRate: 0 });

    const icu = await request(app).get('/api/beds/beds?ward=icu').set(auth(receptionist));
    expect(icu.body.data.beds).toHaveLength(2);
    expect(icu.body.data.stats.totalBeds).toBe(3); // stats are computed before the ward filter (original behaviour)

    const byRoom = await request(app).get(`/api/beds/beds?roomId=${other._id}`).set(auth(receptionist));
    expect(byRoom.body.data.beds.map((b: any) => b.bedNumber)).toEqual(['B-3']);
  });

  it('assigns a bed atomically: only one of concurrent assignments wins', async () => {
    const room = (await createRoom('R-200')).body.data.room;
    const bed = (await createBed('B-200', room._id)).body.data.bed;
    const patients = await Promise.all([1, 2, 3, 4].map((i) => makePatient(`Bed Patient ${i}`)));

    const results = await Promise.all(
      patients.map(({ patient }) =>
        request(app).post(`/api/beds/beds/${bed._id}/assign`).set(auth(receptionist)).send({ patientId: patient._id })
      )
    );
    const ok = results.filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    for (const r of results.filter((x) => x.status !== 200)) {
      expect([400, 409]).toContain(r.status);
    }
    expect(results.some((r) => r.status === 400 && r.body.message === 'Bed is already occupied')).toBe(true);
    expect(ok[0].body.data.bed.status).toBe('occupied');
    expect(ok[0].body.data.bed.currentPatient).toHaveProperty('patientId');

    const detail = await request(app).get(`/api/beds/beds/${bed._id}`).set(auth(receptionist));
    expect(detail.body.data.bed.currentPatient).toHaveProperty('bloodGroup');

    const discharge = await request(app).post(`/api/beds/beds/${bed._id}/discharge`).set(auth(receptionist));
    expect(discharge.status).toBe(200);
    expect(discharge.body.data.bed.status).toBe('available');
    expect(discharge.body.data.bed.currentPatient).toBeUndefined();

    const update = await request(app).put(`/api/beds/beds/${bed._id}`).set(auth(receptionist)).send({ status: 'maintenance' });
    expect(update.status).toBe(200);
    expect(update.body.data.bed.status).toBe('maintenance');
  });

  it('returns 400/404 for bad assign requests', async () => {
    const room = (await createRoom('R-300')).body.data.room;
    const bed = (await createBed('B-300', room._id)).body.data.bed;
    const { patient } = await makePatient();
    expect((await request(app).post(`/api/beds/beds/${bed._id}/assign`).set(auth(receptionist)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/beds/beds/${bed._id}/assign`).set(auth(receptionist)).send({ patientId: 'nope' })).status).toBe(404);
    expect((await request(app).post('/api/beds/beds/nope/assign').set(auth(receptionist)).send({ patientId: patient._id })).status).toBe(404);
    expect((await request(app).get('/api/beds/beds/nope').set(auth(receptionist))).status).toBe(404);
    expect((await request(app).put('/api/beds/beds/nope').set(auth(receptionist)).send({ status: 'reserved' })).status).toBe(404);
    expect((await request(app).put(`/api/beds/beds/${bed._id}`).set(auth(receptionist)).send({ status: 'broken' })).status).toBe(400);
  });

  it('renames a room (moving its guard) and deletes a room with its beds and guards', async () => {
    const room = (await createRoom('R-400')).body.data.room;
    await createBed('B-401', room._id);
    await createBed('B-402', room._id);

    const renamed = await request(app).put(`/api/beds/rooms/${room._id}`).set(auth(admin)).send({ roomNumber: 'R-401', _id: 'hack', ratePerDay: 250 });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.room).toMatchObject({ _id: room._id, roomNumber: 'R-401', ratePerDay: 250 });
    expect((await createRoom('R-400')).status).toBe(201); // old number released
    expect((await createRoom('R-401')).status).toBe(409); // new number claimed
    expect((await request(app).put('/api/beds/rooms/nope').set(auth(admin)).send({ ratePerDay: 1 })).status).toBe(404);

    const del = await request(app).delete(`/api/beds/rooms/${room._id}`).set(auth(admin));
    expect(del.status).toBe(200);
    const beds = await request(app).get(`/api/beds/beds?roomId=${room._id}`).set(auth(admin));
    expect(beds.body.data.beds).toHaveLength(0);
    // Bed numbers and room number can be reused after the cascade delete.
    const again = (await createRoom('R-401')).body.data.room;
    expect((await createBed('B-401', again._id)).status).toBe(201);
    expect((await request(app).delete(`/api/beds/rooms/${room._id}`).set(auth(admin))).status).toBe(404);
  });

  it('deletes a bed and releases its number', async () => {
    const room = (await createRoom('R-500')).body.data.room;
    const bed = (await createBed('B-500', room._id)).body.data.bed;
    expect((await request(app).delete(`/api/beds/beds/${bed._id}`).set(auth(admin))).status).toBe(200);
    expect((await request(app).delete(`/api/beds/beds/${bed._id}`).set(auth(admin))).status).toBe(404);
    expect((await createBed('B-500', room._id)).status).toBe(201);
  });
});

describe('billing', () => {
  const billBody = (patient: string, amount = 100) => ({
    patient,
    items: [
      { description: 'Consultation', category: 'consultation', amount, quantity: 1 },
      { description: 'Medicine', category: 'medicine', amount: 10, quantity: 2 },
    ],
    discount: 5,
    tax: 5,
    dueDate: '2030-01-31',
  });

  const stats = async () => (await request(app).get('/api/billing/stats').set(auth(admin))).body.data;

  it('creates bills with counter ids, records payments and keeps stats in sync', async () => {
    const { patient, token: patientToken } = await makePatient('Billing Pat');
    const before = await stats();

    const created = await request(app).post('/api/billing').set(auth(receptionist)).send(billBody(patient._id));
    expect(created.status).toBe(201);
    const bill = created.body.data.bill;
    expect(bill.billId).toMatch(/^INV-\d{6}$/);
    expect(bill).toMatchObject({ subtotal: 120, totalAmount: 120, balance: 120, paidAmount: 0, status: 'pending' });
    expect(bill.patient).toMatchObject({ _id: patient._id, name: 'Billing Pat' });

    let s = await stats();
    expect(s.totalInvoices - before.totalInvoices).toBe(1);
    expect(s.totalPending - before.totalPending).toBe(120);
    expect(s.pendingCount - before.pendingCount).toBe(1);

    const pay = await request(app).post(`/api/billing/${bill._id}/pay`).set(auth(patientToken)).send({ amount: 20 });
    expect(pay.status).toBe(200);
    expect(pay.body.data.bill).toMatchObject({ paidAmount: 20, balance: 100, status: 'partially_paid' });

    // Concurrent payments are all applied (no lost update).
    const results = await Promise.all(
      [10, 20, 30, 40].map((amount) => request(app).post(`/api/billing/${bill._id}/pay`).set(auth(receptionist)).send({ amount }))
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);

    const detail = await request(app).get(`/api/billing/${bill._id}`).set(auth(admin));
    expect(detail.body.data.bill).toMatchObject({ paidAmount: 120, balance: 0, status: 'paid' });
    expect(detail.body.data.bill.patient).toHaveProperty('bloodGroup'); // full patient populated

    s = await stats();
    expect(s.totalRevenue - before.totalRevenue).toBe(120);
    expect(s.totalPending - before.totalPending).toBe(0);
    expect(s.paidCount - before.paidCount).toBe(1);
    expect(s.pendingCount - before.pendingCount).toBe(0);

    const del = await request(app).delete(`/api/billing/${bill._id}`).set(auth(admin));
    expect(del.status).toBe(200);
    s = await stats();
    expect(s).toEqual(before);
  });

  it('lists bills newest first with patient scoping, filters, search and cursor', async () => {
    const a = await makePatient('List A');
    const b = await makePatient('List B');
    const ids: string[] = [];
    for (const p of [a, a, b]) {
      const res = await request(app).post('/api/billing').set(auth(receptionist)).send(billBody(p.patient._id));
      ids.push(res.body.data.bill._id);
    }
    const billA = (await request(app).get(`/api/billing/${ids[0]}`).set(auth(admin))).body.data.bill;
    await request(app).post(`/api/billing/${ids[1]}/pay`).set(auth(admin)).send({ amount: 500 });

    const mine = await request(app).get('/api/billing').set(auth(a.token));
    expect(mine.body.data.bills.map((x: any) => x._id)).toEqual([ids[1], ids[0]]);
    expect(mine.body.data.bills[0].patient).toMatchObject({ name: 'List A' });

    const byPatient = await request(app).get(`/api/billing?patientId=${a.patient._id}&status=paid`).set(auth(admin));
    expect(byPatient.body.data.bills.map((x: any) => x._id)).toEqual([ids[1]]);

    const page1 = await request(app).get('/api/billing?limit=2').set(auth(admin));
    expect(page1.body.data.bills).toHaveLength(2);
    expect(page1.body.data.pagination.hasMore).toBe(true);
    expect(page1.body.data.bills[0]._id).toBe(ids[2]);
    const page2 = await request(app)
      .get(`/api/billing?limit=2&cursor=${page1.body.data.pagination.nextCursor}`)
      .set(auth(admin));
    expect(page2.body.data.bills[0]._id).toBe(ids[0]);

    const search = await request(app).get(`/api/billing?search=${billA.billId.toLowerCase()}`).set(auth(admin));
    expect(search.body.data.bills.map((x: any) => x._id)).toEqual([ids[0]]);
    // Patient search is scoped to the patient's own bills.
    const otherSearch = await request(app).get(`/api/billing?search=${billA.billId}`).set(auth(b.token));
    expect(otherSearch.body.data.bills).toHaveLength(0);

    const { token: noProfile } = await makeUser('patient');
    const empty = await request(app).get('/api/billing').set(auth(noProfile));
    expect(empty.body.data.bills).toEqual([]);
  });

  it('returns 404/400 for invalid requests', async () => {
    const { patient } = await makePatient();
    expect((await request(app).get('/api/billing/nope').set(auth(admin))).status).toBe(404);
    expect((await request(app).post('/api/billing/nope/pay').set(auth(admin)).send({ amount: 5 })).status).toBe(404);
    expect((await request(app).delete('/api/billing/nope').set(auth(admin))).status).toBe(404);
    expect((await request(app).post('/api/billing').set(auth(admin)).send(billBody('nope'))).status).toBe(404);
    expect((await request(app).post('/api/billing').set(auth(admin)).send({ ...billBody(patient._id), dueDate: 'not-a-date' })).status).toBe(400);
    expect((await request(app).post('/api/billing').set(auth(admin)).send({ patient: patient._id, items: [] })).status).toBe(400);
    expect((await request(app).get('/api/billing?cursor=garbage').set(auth(admin))).status).toBe(400);
  });
});

describe('audit logs', () => {
  it('lists logs newest first with filters and populated user, and returns counter stats', async () => {
    // Previous tests produced audit logs through the controllers.
    const res = await request(app).get('/api/audit-logs?limit=5').set(auth(admin));
    expect(res.status).toBe(200);
    const logs = res.body.data.logs;
    expect(logs).toHaveLength(5);
    const times = logs.map((l: any) => l.timestamp);
    expect([...times].sort().reverse()).toEqual(times);
    expect(logs[0].user).toMatchObject({ name: 'Admin Ann', role: 'admin' });
    expect(logs[0].user.password).toBeUndefined();

    const payments = await request(app).get('/api/audit-logs?action=PAYMENT&entity=Bill&limit=100').set(auth(admin));
    expect(payments.body.data.logs.length).toBeGreaterThanOrEqual(6);
    expect(payments.body.data.logs.every((l: any) => l.action === 'PAYMENT')).toBe(true);

    const search = await request(app).get('/api/audit-logs?search=r-10').set(auth(admin));
    expect(search.body.data.logs.length).toBeGreaterThan(0);
    expect(search.body.data.logs.every((l: any) => /r-10/i.test(l.description + l.userName + l.entityId))).toBe(true);

    const future = await request(app).get('/api/audit-logs?startDate=2099-01-01').set(auth(admin));
    expect(future.body.data.logs).toHaveLength(0);
    const past = await request(app).get('/api/audit-logs?endDate=2000-01-01').set(auth(admin));
    expect(past.body.data.logs).toHaveLength(0);
    const range = await request(app).get(`/api/audit-logs?startDate=2000-01-01&endDate=${new Date(Date.now() + 60000).toISOString()}`).set(auth(admin));
    expect(range.body.data.logs.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/audit-logs?startDate=bad').set(auth(admin))).status).toBe(400);

    const stats = await request(app).get('/api/audit-logs/stats').set(auth(admin));
    expect(stats.status).toBe(200);
    const { totalLogs, actionCounts, entityCounts } = stats.body.data;
    expect(totalLogs).toBe(actionCounts.reduce((s: number, c: any) => s + c.count, 0));
    expect(totalLogs).toBe(entityCounts.reduce((s: number, c: any) => s + c.count, 0));
    expect(actionCounts.find((c: any) => c._id === 'PAYMENT').count).toBeGreaterThanOrEqual(6);
    const counts = actionCounts.map((c: any) => c.count);
    expect([...counts].sort((x: number, y: number) => y - x)).toEqual(counts);

    expect((await request(app).get('/api/audit-logs').set(auth(receptionist))).status).toBe(403);
  });
});

describe('analytics and AI', () => {
  it('returns the hospital overview from aggregates and catalogs', async () => {
    const dept = await makeDepartment('Cardiology Z', 'CARDZ');
    const { doctor } = await makeDoctor(dept._id, 'Dr. Overview');
    const { token: patientToken } = await makePatient('Overview Pat');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const appt = await request(app)
      .post('/api/appointments')
      .set(auth(patientToken))
      .send({ doctor: doctor._id, department: dept._id, date: today.toISOString(), timeSlot: '09:00 AM', symptoms: 'Chest pain' });
    expect(appt.status).toBe(201);

    const billingStats = (await request(app).get('/api/billing/stats').set(auth(admin))).body.data;

    const res = await request(app).get('/api/analytics/overview').set(auth(admin));
    expect(res.status).toBe(200);
    const { kpis, departmentStats, recentLogs, monthlyAppointments } = res.body.data;
    expect(kpis.totalAppointments).toBeGreaterThanOrEqual(1);
    expect(kpis.todayAppointments).toBeGreaterThanOrEqual(1);
    expect(kpis.totalDoctors).toBeGreaterThanOrEqual(1);
    expect(kpis.totalRevenue).toBe(billingStats.totalRevenue);
    expect(kpis.pendingRevenue).toBe(billingStats.totalPending);
    expect(kpis.totalBeds).toBeGreaterThan(0);
    expect(departmentStats.find((d: any) => d.code === 'CARDZ').count).toBe(1);
    expect(recentLogs.length).toBeLessThanOrEqual(10);
    expect(recentLogs[0].PK).toBeUndefined();
    expect(monthlyAppointments).toHaveLength(6);
  });

  it('global search finds patients, doctors, appointments and medicines', async () => {
    const { medicineRepo } = await import('../src/repositories');
    await medicineRepo.create({
      medicineId: 'MED-900001', name: 'Zyntrolamine', genericName: 'zyntro', category: 'Tablet', manufacturer: 'Acme',
      batchNumber: 'B1', expiryDate: '2030-01-01T00:00:00.000Z', quantity: 3, unitPrice: 2, minStockLevel: 10,
      location: 'A1', dailyAvgUsage: 2, status: 'low_stock',
    });
    const { patient } = await makePatient('Quixotic Searchable');

    const res = await request(app).get('/api/analytics/search?q=quixo').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.patients).toEqual([
      { _id: patient._id, name: 'Quixotic Searchable', patientId: patient.patientId, phone: patient.phone, email: patient.email },
    ]);

    const doc = await request(app).get('/api/analytics/search?q=overview').set(auth(admin));
    expect(doc.body.data.doctors[0]).toMatchObject({ name: 'Dr. Overview', specialization: 'Cardiology' });
    expect(Object.keys(doc.body.data.doctors[0]).sort()).toEqual(['_id', 'name', 'roomNumber', 'specialization']);

    const appt = await request(app).get('/api/analytics/search?q=apt-').set(auth(admin));
    expect(appt.body.data.appointments.length).toBeGreaterThan(0);
    expect(appt.body.data.appointments[0].patient).toHaveProperty('name');
    expect(appt.body.data.appointments[0].doctor).toHaveProperty('name');

    const med = await request(app).get('/api/analytics/search?q=TROLAM').set(auth(admin));
    expect(med.body.data.medicines).toHaveLength(1);
    expect(Object.keys(med.body.data.medicines[0]).sort()).toEqual(['_id', 'medicineId', 'name', 'quantity', 'status', 'unitPrice']);

    const short = await request(app).get('/api/analytics/search?q=a').set(auth(admin));
    expect(short.body.data).toEqual({ patients: [], doctors: [], appointments: [], medicines: [] });

    const overview = await request(app).get('/api/analytics/overview').set(auth(admin));
    expect(overview.body.data.kpis.lowStockMeds).toBeGreaterThanOrEqual(1);
  });

  it('AI endpoints use the catalogs', async () => {
    const res = await request(app).post('/api/ai/symptoms').send({ symptoms: 'severe chest pain and palpitations' });
    expect(res.status).toBe(200);
    expect(res.body.data.recommendation).toHaveProperty('departmentCode');
    expect(Array.isArray(res.body.data.recommendedDoctors)).toBe(true);
    for (const d of res.body.data.recommendedDoctors) {
      expect(d.status).toBe('active');
      if (d.department) expect(Object.keys(d.department).sort()).toEqual(['_id', 'code', 'name']);
    }
    expect((await request(app).post('/api/ai/symptoms').send({ symptoms: 'x' })).status).toBe(400);

    const inv = await request(app).get('/api/ai/inventory-forecast').set(auth(admin));
    expect(inv.status).toBe(200);
    expect(inv.body.data.totalAnalyzed).toBeGreaterThanOrEqual(1);

    const beds = await request(app).get('/api/ai/bed-forecast').set(auth(admin));
    expect(beds.status).toBe(200);
    expect(beds.body.data).toHaveProperty('riskLevel');
    expect(beds.body.data.totalBeds).toBeGreaterThan(0);
  });
});

describe('concurrency and aggregate integrity (review additions)', () => {
  const body = (patient: string, amount: number) => ({
    patient,
    items: [{ description: 'Procedure', category: 'procedure', amount, quantity: 1 }],
    dueDate: '2030-06-30',
  });
  const stats = async () => (await request(app).get('/api/billing/stats').set(auth(admin))).body.data;

  it('concurrent bill creation, payments on different bills and deletes keep STATS#BILLING exact', async () => {
    const { patient } = await makePatient('Concurrent Billing');
    const before = await stats();

    // 6 bills created at the same time all touch the shared stats item.
    const created = await Promise.all(
      [10, 20, 30, 40, 50, 60].map((a) => request(app).post('/api/billing').set(auth(receptionist)).send(body(patient._id, a)))
    );
    expect(created.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201]);
    const bills = created.map((r) => r.body.data.bill);
    expect(new Set(bills.map((b) => b.billId)).size).toBe(6); // counter ids never collide

    let s = await stats();
    expect(s.totalInvoices - before.totalInvoices).toBe(6);
    expect(s.totalPending - before.totalPending).toBe(210);
    expect(s.pendingCount - before.pendingCount).toBe(6);

    // Pay every bill in full at the same time (different bills, same stats item).
    const paid = await Promise.all(
      bills.map((b) => request(app).post(`/api/billing/${b._id}/pay`).set(auth(admin)).send({ amount: b.totalAmount }))
    );
    expect(paid.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    s = await stats();
    expect(s.totalRevenue - before.totalRevenue).toBe(210);
    expect(s.totalPending - before.totalPending).toBe(0);
    expect(s.paidCount - before.paidCount).toBe(6);
    expect(s.pendingCount - before.pendingCount).toBe(0);

    // Overpayment keeps the original math: balance clamps at 0, paidAmount keeps growing.
    const over = await request(app).post(`/api/billing/${bills[0]._id}/pay`).set(auth(admin)).send({ amount: 5 });
    expect(over.body.data.bill).toMatchObject({ paidAmount: 15, balance: 0, status: 'paid' });
    expect(over.body.data.bill.patient).toEqual({ _id: patient._id, name: 'Concurrent Billing', patientId: patient.patientId });
    expect((await request(app).post(`/api/billing/${bills[0]._id}/pay`).set(auth(admin)).send({ amount: 0 })).status).toBe(400);

    // Concurrent deletes (plus a duplicate delete of the same bill) subtract exactly once each.
    const dels = await Promise.all([...bills, bills[1]].map((b) => request(app).delete(`/api/billing/${b._id}`).set(auth(admin))));
    expect(dels.filter((r) => r.status === 200)).toHaveLength(6);
    expect(dels.filter((r) => r.status === 404)).toHaveLength(1);
    s = await stats();
    expect(s.totalInvoices).toBe(before.totalInvoices);
    expect(s.totalRevenue).toBe(before.totalRevenue);
    expect(s.totalPending).toBe(before.totalPending);
    expect(s.paidCount).toBe(before.paidCount);
  });

  it('search returns up to limit bills of the scoped patient', async () => {
    const p = await makePatient('Search Scope');
    const mine = await request(app).post('/api/billing').set(auth(receptionist)).send(body(p.patient._id, 1));
    const res = await request(app).get('/api/billing?search=INV-').set(auth(p.token));
    expect(res.status).toBe(200);
    expect(res.body.data.bills.map((b: any) => b._id)).toEqual([mine.body.data.bill._id]);
    const lim = await request(app).get('/api/billing?search=INV-&limit=2').set(auth(admin));
    expect(lim.body.data.bills).toHaveLength(2);
  });

  it('concurrent room creation with the same number: exactly one wins', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4].map(() =>
        request(app).post('/api/beds/rooms').set(auth(admin)).send({ roomNumber: 'R-CONC', building: 'Main', floor: '2', roomType: 'private', ratePerDay: 1 })
      )
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.message === 'Room number already exists')).toBe(true);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
  });

  it('room update ignores internal key attributes and rejects taking another room number', async () => {
    const a = (await createRoom('R-KEY-A')).body.data.room;
    const b = (await createRoom('R-KEY-B')).body.data.room;
    const res = await request(app)
      .put(`/api/beds/rooms/${a._id}`)
      .set(auth(admin))
      .send({ GSI2PK: `ROOM#${b._id}`, GSI2SK: 'BED#zzz', PK: 'X', version: 99, floor: '3' });
    expect(res.status).toBe(200);
    expect(res.body.data.room).toMatchObject({ _id: a._id, floor: '3' });
    // The room did not leak into the bed list of room B.
    const bedsOfB = await request(app).get(`/api/beds/beds?roomId=${b._id}`).set(auth(admin));
    expect(bedsOfB.body.data.beds).toHaveLength(0);
    // It is still readable/updatable under its own key.
    expect((await request(app).put(`/api/beds/rooms/${a._id}`).set(auth(admin)).send({ ratePerDay: 7 })).status).toBe(200);

    const taken = await request(app).put(`/api/beds/rooms/${a._id}`).set(auth(admin)).send({ roomNumber: 'r-key-b' });
    expect(taken.status).toBe(409);
    expect(taken.body.message).toBe('Room number already exists');
    // Failed rename left the old guard in place.
    expect((await createRoom('R-KEY-A')).status).toBe(409);
  });

  it('room delete cascades to many beds (more than one transaction) and releases all bed numbers', async () => {
    const room = (await createRoom('R-BIG')).body.data.room;
    const n = 52;
    for (let i = 0; i < n; i += 13) {
      await Promise.all(
        Array.from({ length: Math.min(13, n - i) }, (_, k) => createBed(`BIG-${i + k}`, room._id))
      );
    }
    const before = await request(app).get(`/api/beds/beds?roomId=${room._id}`).set(auth(admin));
    expect(before.body.data.beds).toHaveLength(n);
    expect((await request(app).delete(`/api/beds/rooms/${room._id}`).set(auth(admin))).status).toBe(200);
    const after = await request(app).get(`/api/beds/beds?roomId=${room._id}`).set(auth(admin));
    expect(after.body.data.beds).toHaveLength(0);
    const fresh = (await createRoom('R-BIG')).body.data.room;
    expect((await createBed('BIG-0', fresh._id)).status).toBe(201);
    expect((await createBed(`BIG-${n - 1}`, fresh._id)).status).toBe(201);
  });

  it('audit log end date bound includes logs at that exact instant', async () => {
    const first = (await request(app).get('/api/audit-logs?limit=1').set(auth(admin))).body.data.logs[0];
    const exact = await request(app)
      .get(`/api/audit-logs?startDate=${first.timestamp}&endDate=${first.timestamp}`)
      .set(auth(admin));
    expect(exact.body.data.logs.map((l: any) => l._id)).toContain(first._id);
    expect(exact.body.data.logs.every((l: any) => l.timestamp === first.timestamp)).toBe(true);
  });
});
