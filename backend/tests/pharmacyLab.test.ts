import request from 'supertest';
import { setupTestTable, teardownTestTable } from './helpers/dynamoLocal';
import { makeDepartment, makeDoctor, makePatient, makeUser } from './helpers/factory';
import type { Application } from 'express';

let app: Application;
let table: string;
let admin: string;
let pharmacist: string;
let labTech: string;

beforeAll(async () => {
  table = await setupTestTable();
  app = (await import('../src/app')).default;
  admin = (await makeUser('admin')).token;
  pharmacist = (await makeUser('pharmacist')).token;
  labTech = (await makeUser('lab_technician')).token;
});
afterAll(() => teardownTestTable(table));

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const medicineBody = (overrides: Record<string, any> = {}) => ({
  name: 'Paracetamol',
  genericName: 'Acetaminophen',
  category: 'Analgesic',
  manufacturer: 'Acme Pharma',
  batchNumber: 'B-100',
  expiryDate: '2035-01-01',
  quantity: 50,
  unitPrice: 2.5,
  minStockLevel: 10,
  ...overrides,
});

const createMedicine = async (overrides: Record<string, any> = {}) => {
  const res = await request(app).post('/api/pharmacy/medicines').set(auth(pharmacist)).send(medicineBody(overrides));
  expect(res.status).toBe(201);
  return res.body.data.medicine;
};

describe('pharmacy: medicines', () => {
  it('creates a medicine with a counter id, status and an initial stock transaction', async () => {
    const med = await createMedicine({ name: 'Ibuprofen', quantity: 8 });
    expect(med.medicineId).toMatch(/^MED-\d{6}$/);
    expect(med.status).toBe('low_stock');
    expect(med.location).toBe('Shelf A');
    expect(med.PK).toBeUndefined();
    expect(med.version).toBeUndefined();

    const tx = await request(app).get(`/api/pharmacy/transactions?medicineId=${med._id}`).set(auth(pharmacist));
    expect(tx.status).toBe(200);
    expect(tx.body.data.transactions).toHaveLength(1);
    expect(tx.body.data.transactions[0]).toMatchObject({
      type: 'stock_in',
      quantity: 8,
      reason: 'Initial stock entry',
      medicine: { _id: med._id, name: 'Ibuprofen', medicineId: med.medicineId },
      performedBy: { name: 'Test pharmacist', role: 'pharmacist' },
    });
    expect(tx.body.data.transactions[0].performedBy.password).toBeUndefined();
  });

  it('lists medicines sorted by name with search, filters and cursor pagination', async () => {
    await createMedicine({ name: 'Zinc Tablets', manufacturer: 'SearchCo Labs', category: 'Supplement' });
    await createMedicine({ name: 'Amoxicillin', category: 'Antibiotic', quantity: 0 });
    await createMedicine({ name: 'Expired Syrup', expiryDate: '2000-01-01' });

    const search = await request(app).get('/api/pharmacy/medicines?search=searchco').set(auth(admin));
    expect(search.status).toBe(200);
    expect(search.body.data.medicines.map((m: any) => m.name)).toEqual(['Zinc Tablets']);

    const byStatus = await request(app).get('/api/pharmacy/medicines?status=out_of_stock').set(auth(admin));
    expect(byStatus.body.data.medicines.map((m: any) => m.name)).toEqual(['Amoxicillin']);
    const expired = await request(app).get('/api/pharmacy/medicines?status=expired').set(auth(admin));
    expect(expired.body.data.medicines.map((m: any) => m.name)).toEqual(['Expired Syrup']);
    const byCategory = await request(app).get('/api/pharmacy/medicines?category=Antibiotic').set(auth(admin));
    expect(byCategory.body.data.medicines).toHaveLength(1);

    const page1 = await request(app).get('/api/pharmacy/medicines?limit=2').set(auth(admin));
    expect(page1.body.data.medicines).toHaveLength(2);
    expect(page1.body.data.pagination.hasMore).toBe(true);
    const page2 = await request(app)
      .get(`/api/pharmacy/medicines?limit=2&cursor=${page1.body.data.pagination.nextCursor}`)
      .set(auth(admin));
    const names = [...page1.body.data.medicines, ...page2.body.data.medicines].map((m: any) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    expect(new Set(names).size).toBe(names.length);
  });

  it('updates a medicine and recomputes its status; get/delete return 404 for unknown ids', async () => {
    const med = await createMedicine({ name: 'Cetirizine' });
    const upd = await request(app).put(`/api/pharmacy/medicines/${med._id}`).set(auth(pharmacist)).send({ quantity: 0 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.medicine).toMatchObject({ quantity: 0, status: 'out_of_stock', name: 'Cetirizine', minStockLevel: 10 });

    const bad = await request(app).put(`/api/pharmacy/medicines/${med._id}`).set(auth(pharmacist)).send({ quantity: 'x' });
    expect(bad.status).toBe(400);

    expect((await request(app).get('/api/pharmacy/medicines/nope').set(auth(admin))).status).toBe(404);
    expect((await request(app).put('/api/pharmacy/medicines/nope').set(auth(admin)).send({ quantity: 1 })).status).toBe(404);

    const del = await request(app).delete(`/api/pharmacy/medicines/${med._id}`).set(auth(admin));
    expect(del.status).toBe(200);
    expect((await request(app).get(`/api/pharmacy/medicines/${med._id}`).set(auth(admin))).status).toBe(404);
    expect((await request(app).delete(`/api/pharmacy/medicines/${med._id}`).set(auth(admin))).status).toBe(404);
  });

  it('rejects an invalid expiry date with 400', async () => {
    const res = await request(app).post('/api/pharmacy/medicines').set(auth(pharmacist)).send(medicineBody({ expiryDate: 'not-a-date' }));
    expect(res.status).toBe(400);
  });
});

describe('pharmacy: stock adjustments', () => {
  it('applies stock_in / stock_out / adjustment and rejects insufficient stock', async () => {
    const med = await createMedicine({ name: 'Adjustable', quantity: 20 });
    const url = `/api/pharmacy/medicines/${med._id}/adjust-stock`;

    const out = await request(app).post(url).set(auth(pharmacist)).send({ quantity: 15, type: 'stock_out', reason: 'Dispensed' });
    expect(out.status).toBe(200);
    expect(out.body.data.medicine).toMatchObject({ quantity: 5, status: 'low_stock' });
    expect(out.body.data.transaction).toMatchObject({ type: 'stock_out', quantity: 15, medicine: med._id });

    const tooMuch = await request(app).post(url).set(auth(pharmacist)).send({ quantity: 6, type: 'stock_out', reason: 'x' });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toBe('Insufficient stock available');

    const inn = await request(app).post(url).set(auth(pharmacist)).send({ quantity: 100, type: 'stock_in', reason: 'Delivery' });
    expect(inn.body.data.medicine).toMatchObject({ quantity: 105, status: 'in_stock' });
    const adj = await request(app).post(url).set(auth(pharmacist)).send({ quantity: 7, type: 'adjustment', reason: 'Count' });
    expect(adj.body.data.medicine.quantity).toBe(7);

    const missing = await request(app).post(url).set(auth(pharmacist)).send({ quantity: 1, type: 'stock_in' });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('Quantity, type, and reason are required');
    const badType = await request(app).post(url).set(auth(pharmacist)).send({ quantity: 1, type: 'gift', reason: 'x' });
    expect(badType.status).toBe(400);
    const notFound = await request(app).post('/api/pharmacy/medicines/nope/adjust-stock').set(auth(pharmacist))
      .send({ quantity: 1, type: 'stock_in', reason: 'x' });
    expect(notFound.status).toBe(404);

    // Ledger: initial entry + 4 successful adjustments, newest first.
    const tx = await request(app).get(`/api/pharmacy/transactions?medicineId=${med._id}`).set(auth(admin));
    expect(tx.body.data.transactions.map((t: any) => t.type)).toEqual(['adjustment', 'stock_in', 'stock_out', 'stock_in']);
  });

  it('never loses concurrent stock_out updates or goes below zero', async () => {
    const med = await createMedicine({ name: 'Contended', quantity: 10, minStockLevel: 0 });
    const url = `/api/pharmacy/medicines/${med._id}/adjust-stock`;

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app).post(url).set(auth(pharmacist)).send({ quantity: 2, type: 'stock_out', reason: 'Concurrent' })
      )
    );
    const ok = results.filter((r) => r.status === 200).length;
    const insufficient = results.filter((r) => r.status === 400).length;
    const conflicts = results.filter((r) => r.status === 409).length;
    expect(ok + insufficient + conflicts).toBe(8);
    expect(ok).toBeLessThanOrEqual(5);
    // "Insufficient stock" may only be reported once the stock really ran out.
    if (insufficient > 0) expect(ok).toBe(5);
    results.filter((r) => r.status === 400).forEach((r) => expect(r.body.message).toBe('Insufficient stock available'));

    const final = await request(app).get(`/api/pharmacy/medicines/${med._id}`).set(auth(admin));
    expect(final.body.data.medicine.quantity).toBe(10 - 2 * ok);
    expect(final.body.data.medicine.quantity).toBeGreaterThanOrEqual(0);

    // Exactly one ledger entry per successful adjustment (plus the initial one).
    const tx = await request(app).get(`/api/pharmacy/transactions?medicineId=${med._id}&limit=50`).set(auth(admin));
    expect(tx.body.data.transactions.filter((t: any) => t.type === 'stock_out')).toHaveLength(ok);
  });

  it('never loses concurrent stock_in updates', async () => {
    const med = await createMedicine({ name: 'Concurrent Delivery', quantity: 1 });
    const url = `/api/pharmacy/medicines/${med._id}/adjust-stock`;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app).post(url).set(auth(pharmacist)).send({ quantity: 3, type: 'stock_in', reason: 'Delivery' })
      )
    );
    const ok = results.filter((r) => r.status === 200).length;
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(ok).toBeGreaterThan(0);

    const final = await request(app).get(`/api/pharmacy/medicines/${med._id}`).set(auth(admin));
    expect(final.body.data.medicine.quantity).toBe(1 + 3 * ok);
    const tx = await request(app).get(`/api/pharmacy/transactions?medicineId=${med._id}&limit=50`).set(auth(admin));
    expect(tx.body.data.transactions).toHaveLength(1 + ok);
  });

  it('gives concurrently created medicines distinct counter ids', async () => {
    const created = await Promise.all(Array.from({ length: 5 }, (_, i) => createMedicine({ name: `Parallel ${i}`, quantity: 0 })));
    const ids = created.map((m: any) => m.medicineId);
    expect(new Set(ids).size).toBe(5);
    // quantity 0 -> no initial ledger entry (as in the original).
    const tx = await request(app).get(`/api/pharmacy/transactions?medicineId=${created[0]._id}`).set(auth(admin));
    expect(tx.body.data.transactions).toHaveLength(0);
  });

  it('returns inventory predictions for the catalog sorted by quantity', async () => {
    const res = await request(app).get('/api/pharmacy/medicines/predictions').set(auth(admin));
    expect(res.status).toBe(200);
    const { summary, predictions } = res.body.data;
    expect(summary.total).toBe(predictions.length);
    expect(summary.criticalCount + summary.warningCount + summary.normalCount).toBe(summary.total);
    const quantities = predictions.map((p: any) => p.currentQuantity);
    expect(quantities).toEqual([...quantities].sort((a, b) => a - b));
  });

  it('lists the hospital-wide ledger newest first with cursor pagination', async () => {
    const page1 = await request(app).get('/api/pharmacy/transactions?limit=3').set(auth(admin));
    expect(page1.status).toBe(200);
    expect(page1.body.data.transactions).toHaveLength(3);
    const ts = page1.body.data.transactions.map((t: any) => t.timestamp);
    expect(ts).toEqual([...ts].sort().reverse());
    expect(page1.body.data.pagination.hasMore).toBe(true);
    const page2 = await request(app)
      .get(`/api/pharmacy/transactions?limit=3&cursor=${page1.body.data.pagination.nextCursor}`)
      .set(auth(admin));
    expect(page2.body.data.transactions[0].timestamp <= ts[2]).toBe(true);

    expect((await request(app).get('/api/pharmacy/transactions?cursor=garbage').set(auth(admin))).status).toBe(400);
  });
});

describe('pharmacy: dispensing', () => {
  const makePrescription = async () => {
    const { prescriptionRepo } = await import('../src/repositories');
    const dept = await makeDepartment();
    const { doctor } = await makeDoctor(dept._id);
    const { patient } = await makePatient();
    return prescriptionRepo.create({
      prescriptionId: `RX-TEST-${Math.random()}`,
      patient: patient._id,
      doctor: doctor._id,
      date: new Date().toISOString(),
      medicines: [{ medicineName: 'Paracetamol', dosage: '500mg', frequency: 'BID', duration: '5d', instructions: '' }],
      status: 'active',
      notes: '',
    });
  };

  it('dispenses once; a second dispense is rejected', async () => {
    const rx = await makePrescription();
    const res = await request(app).post('/api/pharmacy/dispense').set(auth(pharmacist)).send({ prescriptionId: rx._id });
    expect(res.status).toBe(200);
    expect(res.body.data.prescription).toMatchObject({ status: 'dispensed', medicines: [{ medicineName: 'Paracetamol' }] });

    const again = await request(app).post('/api/pharmacy/dispense').set(auth(pharmacist)).send({ prescriptionId: rx._id });
    expect(again.status).toBe(400);
    expect(again.body.message).toBe('Prescription already dispensed');

    const missing = await request(app).post('/api/pharmacy/dispense').set(auth(pharmacist)).send({ prescriptionId: 'nope' });
    expect(missing.status).toBe(404);
    const noId = await request(app).post('/api/pharmacy/dispense').set(auth(pharmacist)).send({});
    expect(noId.status).toBe(404);
  });

  it('lets only one of several concurrent dispense requests succeed', async () => {
    const rx = await makePrescription();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/pharmacy/dispense').set(auth(pharmacist)).send({ prescriptionId: rx._id })
      )
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.every((r) => [200, 400, 409].includes(r.status))).toBe(true);
  });
});

describe('lab tests catalog', () => {
  const testBody = (overrides: Record<string, any> = {}) => ({
    name: 'Complete Blood Count',
    category: 'Hematology',
    price: 25,
    description: 'Blood cell counts',
    normalRange: 'Varies',
    ...overrides,
  });

  it('creates, lists, searches, updates and deletes lab tests', async () => {
    const a = await request(app).post('/api/lab/tests').set(auth(labTech)).send(testBody());
    expect(a.status).toBe(201);
    expect(a.body.data.test.testCode).toMatch(/^LT-\d{3}$/);
    expect(a.body.data.test.turnaroundHours).toBe(24);
    const b = await request(app).post('/api/lab/tests').set(auth(labTech)).send(testBody({ name: 'Lipid Panel', category: 'Biochemistry' }));
    expect(b.body.data.test.testCode).not.toBe(a.body.data.test.testCode);

    const list = await request(app).get('/api/lab/tests').set(auth(admin));
    expect(list.body.data.tests.map((t: any) => t.name)).toEqual(['Lipid Panel', 'Complete Blood Count']); // by category, name
    const search = await request(app).get('/api/lab/tests?search=lipid').set(auth(admin));
    expect(search.body.data.tests).toHaveLength(1);
    const byCategory = await request(app).get('/api/lab/tests?category=Hematology').set(auth(admin));
    expect(byCategory.body.data.tests.map((t: any) => t.name)).toEqual(['Complete Blood Count']);

    // Raw body update: unknown/internal fields are ignored, testCode is uppercased.
    const upd = await request(app).put(`/api/lab/tests/${a.body.data.test._id}`).set(auth(labTech))
      .send({ price: '30', testCode: 'lt-cbc', _id: 'hijack', createdAt: '1999-01-01', bogus: 1 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.test).toMatchObject({ _id: a.body.data.test._id, price: 30, testCode: 'LT-CBC', createdAt: a.body.data.test.createdAt });
    expect(upd.body.data.test.bogus).toBeUndefined();

    // The new code is now unique; the old code was released.
    const clash = await request(app).put(`/api/lab/tests/${b.body.data.test._id}`).set(auth(labTech)).send({ testCode: 'LT-CBC' });
    expect(clash.status).toBe(409);
    const reuseOld = await request(app).put(`/api/lab/tests/${b.body.data.test._id}`).set(auth(labTech)).send({ testCode: a.body.data.test.testCode });
    expect(reuseOld.status).toBe(200);

    expect((await request(app).put(`/api/lab/tests/${b.body.data.test._id}`).set(auth(labTech)).send({ price: 'abc' })).status).toBe(400);
    expect((await request(app).get('/api/lab/tests/nope').set(auth(admin))).status).toBe(404);
    expect((await request(app).put('/api/lab/tests/nope').set(auth(labTech)).send({ price: 1 })).status).toBe(404);

    const del = await request(app).delete(`/api/lab/tests/${a.body.data.test._id}`).set(auth(admin));
    expect(del.status).toBe(200);
    expect((await request(app).delete(`/api/lab/tests/${a.body.data.test._id}`).set(auth(admin))).status).toBe(404);
    // Deleting released LT-CBC, so another test may take it.
    const take = await request(app).put(`/api/lab/tests/${b.body.data.test._id}`).set(auth(labTech)).send({ testCode: 'LT-CBC' });
    expect(take.status).toBe(200);
  });

  it('gives concurrently created lab tests distinct codes and rejects non-scalar update values', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => request(app).post('/api/lab/tests').set(auth(labTech)).send(testBody({ name: `Parallel Test ${i}` })))
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const codes = results.map((r) => r.body.data.test.testCode);
    expect(new Set(codes).size).toBe(5);

    const id = results[0].body.data.test._id;
    expect((await request(app).put(`/api/lab/tests/${id}`).set(auth(labTech)).send({ name: { $gt: '' } })).status).toBe(400);
    expect((await request(app).put(`/api/lab/tests/${id}`).set(auth(labTech)).send({ name: '   ' })).status).toBe(400);
  });

  it('rejects an invalid create body with 400', async () => {
    const res = await request(app).post('/api/lab/tests').set(auth(labTech)).send({ name: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('lab reports', () => {
  it('creates, lists (scoped and filtered), updates and deletes reports', async () => {
    const dept = await makeDepartment();
    const { doctor } = await makeDoctor(dept._id, 'Dr. Lab Orderer');
    const p1 = await makePatient('Lab Patient One');
    const p2 = await makePatient('Lab Patient Two');
    const test = (await request(app).post('/api/lab/tests').set(auth(labTech)).send({
      name: 'Glucose', category: 'Biochemistry', price: 10, description: 'Fasting glucose', normalRange: '70-100',
    })).body.data.test;

    const create = (patient: string) =>
      request(app).post('/api/lab/reports').set(auth(admin)).send({ patient, doctor: doctor._id, labTest: test._id, notes: 'Fasting' });
    const r1 = await create(p1.patient._id);
    expect(r1.status).toBe(201);
    expect(r1.body.data.report).toMatchObject({
      status: 'requested',
      results: [],
      notes: 'Fasting',
      patient: { _id: p1.patient._id, name: 'Lab Patient One' },
      doctor: { _id: doctor._id, name: 'Dr. Lab Orderer' },
      labTest: { _id: test._id, name: 'Glucose', testCode: test.testCode },
    });
    expect(r1.body.data.report.reportId).toMatch(/^LAB-\d{6}$/);
    await create(p2.patient._id);
    await create(p2.patient._id);

    // Patient role only sees their own reports.
    const mine = await request(app).get('/api/lab/reports').set(auth(p1.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.reports).toHaveLength(1);
    expect(mine.body.data.reports[0].patient).toMatchObject({ _id: p1.patient._id, bloodGroup: 'A+' });
    const mineEvenIfAsked = await request(app).get(`/api/lab/reports?patientId=${p2.patient._id}`).set(auth(p1.token));
    expect(mineEvenIfAsked.body.data.reports).toHaveLength(1);

    const byDoctor = await request(app).get(`/api/lab/reports?doctorId=${doctor._id}`).set(auth(admin));
    expect(byDoctor.body.data.reports).toHaveLength(3);
    const byPatient = await request(app).get(`/api/lab/reports?patientId=${p2.patient._id}&limit=1`).set(auth(admin));
    expect(byPatient.body.data.reports).toHaveLength(1);
    expect(byPatient.body.data.pagination.hasMore).toBe(true);

    // Update status/results; performedBy is the current user.
    const upd = await request(app).put(`/api/lab/reports/${r1.body.data.report._id}`).set(auth(labTech)).send({
      status: 'completed',
      results: [{ parameter: 'Glucose', result: '90', unit: 'mg/dL', normalRange: '70-100', isAbnormal: false }],
    });
    expect(upd.status).toBe(200);
    expect(upd.body.data.report).toMatchObject({ status: 'completed', notes: 'Fasting', labTest: { normalRange: '70-100' } });

    const completed = await request(app).get('/api/lab/reports?status=completed').set(auth(admin));
    expect(completed.body.data.reports).toHaveLength(1);
    expect(completed.body.data.reports[0].performedBy).toMatchObject({ name: 'Test lab_technician', role: 'lab_technician' });

    const one = await request(app).get(`/api/lab/reports/${r1.body.data.report._id}`).set(auth(admin));
    expect(one.status).toBe(200);
    expect(one.body.data.report.labTest).toMatchObject({ description: 'Fasting glucose', turnaroundHours: 24 });
    expect(one.body.data.report.doctor).toMatchObject({ department: dept._id });

    // Concurrent edits of one report: never a lost update (each either succeeds or gets 409).
    const r2 = (await request(app).get(`/api/lab/reports?patientId=${p2.patient._id}`).set(auth(admin))).body.data.reports[0];
    const edits = await Promise.all(
      ['n1', 'n2', 'n3', 'n4'].map((notes) =>
        request(app).put(`/api/lab/reports/${r2._id}`).set(auth(labTech)).send({ notes })
      )
    );
    expect(edits.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(edits.some((r) => r.status === 200)).toBe(true);

    expect((await request(app).put(`/api/lab/reports/${r1.body.data.report._id}`).set(auth(labTech)).send({ status: 'bogus' })).status).toBe(400);
    expect((await request(app).put('/api/lab/reports/nope').set(auth(labTech)).send({ status: 'processing' })).status).toBe(404);
    expect((await request(app).get('/api/lab/reports/nope').set(auth(admin))).status).toBe(404);
    expect((await request(app).post('/api/lab/reports').set(auth(admin)).send({ patient: 'x' })).status).toBe(400);

    expect((await request(app).delete(`/api/lab/reports/${r1.body.data.report._id}`).set(auth(admin))).status).toBe(200);
    expect((await request(app).delete(`/api/lab/reports/${r1.body.data.report._id}`).set(auth(admin))).status).toBe(404);
    const after = await request(app).get('/api/lab/reports').set(auth(p1.token));
    expect(after.body.data.reports).toHaveLength(0);
  });

  it('returns an empty list for a patient user without a profile', async () => {
    const { token } = await makeUser('patient');
    const res = await request(app).get('/api/lab/reports').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.reports).toEqual([]);
  });
});
