import request from 'supertest';
import { setupTestTable, teardownTestTable } from './helpers/dynamoLocal';
import { makeDepartment, makeDoctor, makePatient, makeUser } from './helpers/factory';
import { createNotification } from '../src/repositories/notifications';
import type { Application } from 'express';

let app: Application;
let table: string;

beforeAll(async () => {
  table = await setupTestTable();
  app = (await import('../src/app')).default;
});
afterAll(() => teardownTestTable(table));

const vitals = { bloodPressure: '120/80', heartRate: 72, temperature: 36.8, oxygenSaturation: 98, weight: 70, height: 175 };
const recordBody = (patient: string, doctor: string, extra: object = {}) => ({
  patient, doctor, symptoms: 'Persistent cough', diagnosis: 'Bronchitis', vitals, ...extra,
});
const rxBody = (patient: string, doctor: string) => ({
  patient, doctor,
  medicines: [{ medicineName: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days', instructions: 'After meals' }],
});

describe('medical records', () => {
  it('creates a record with a counter id and populated refs, then fetches it by id', async () => {
    const dept = await makeDepartment();
    const { doctor, token: doctorToken } = await makeDoctor(dept._id, 'Dr. Lung');
    const { patient } = await makePatient('Emr Patient');

    const res = await request(app)
      .post('/api/emr/records')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send(recordBody(patient._id, doctor._id, { followUpDate: '2030-05-01' }));
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Medical record created');
    expect(res.body.record.recordId).toMatch(/^EMR-\d{4}-\d{5}$/);
    expect(res.body.record.patient).toEqual({ _id: patient._id, patientId: patient.patientId, name: 'Emr Patient' });
    expect(res.body.record.doctor).toMatchObject({ _id: doctor._id, name: 'Dr. Lung', specialization: 'Cardiology' });
    expect(res.body.record.clinicalNotes).toBe('');
    expect(res.body.record.attachments).toEqual([]);
    expect(res.body.record.followUpDate).toBe(new Date('2030-05-01').toISOString());
    expect(res.body.record.PK).toBeUndefined();
    expect(res.body.record.version).toBeUndefined();

    const one = await request(app).get(`/api/emr/records/${res.body.record._id}`).set('Authorization', `Bearer ${doctorToken}`);
    expect(one.status).toBe(200);
    expect(one.body.record.patient).toMatchObject({ _id: patient._id, bloodGroup: 'A+', gender: 'female' });
    expect(one.body.record.doctor).toMatchObject({ qualification: 'MD' });
    expect(one.body.record.patient).toHaveProperty('medicalHistory');
    expect(one.body.record.patient.password).toBeUndefined();
  });

  it('generates unique record ids under concurrent creation', async () => {
    const dept = await makeDepartment();
    const { doctor, token } = await makeDoctor(dept._id);
    const { patient } = await makePatient();
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map(() => request(app).post('/api/emr/records').set('Authorization', `Bearer ${token}`).send(recordBody(patient._id, doctor._id)))
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const ids = new Set(results.map((r) => r.body.record.recordId));
    expect(ids.size).toBe(5);
  });

  it('scopes lists by role, sorts newest first and paginates with a cursor', async () => {
    const dept = await makeDepartment();
    const docA = await makeDoctor(dept._id, 'Dr. A');
    const docB = await makeDoctor(dept._id, 'Dr. B');
    const pat1 = await makePatient('Scope One');
    const pat2 = await makePatient('Scope Two');
    const post = (token: string, p: string, d: string) =>
      request(app).post('/api/emr/records').set('Authorization', `Bearer ${token}`).send(recordBody(p, d));

    const r1 = await post(docA.token, pat1.patient._id, docA.doctor._id);
    const r2 = await post(docA.token, pat1.patient._id, docA.doctor._id);
    const r3 = await post(docB.token, pat1.patient._id, docB.doctor._id);
    await post(docB.token, pat2.patient._id, docB.doctor._id);

    // Patient sees only their own records, even if asking for someone else's.
    const mine = await request(app)
      .get(`/api/emr/records?patient=${pat2.patient._id}`)
      .set('Authorization', `Bearer ${pat1.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.records.map((r: any) => r._id)).toEqual([r3.body.record._id, r2.body.record._id, r1.body.record._id]);
    expect(mine.body.pagination).toMatchObject({ limit: 20, count: 3, hasMore: false, nextCursor: null });

    // Doctor sees only their own records.
    const docList = await request(app).get('/api/emr/records').set('Authorization', `Bearer ${docA.token}`);
    expect(docList.body.records).toHaveLength(2);
    expect(docList.body.records.every((r: any) => r.doctor._id === docA.doctor._id)).toBe(true);

    // Staff filter by patient + doctor, ascending, page by page.
    const { token: adminToken } = await makeUser('admin');
    const page1 = await request(app)
      .get(`/api/emr/records?patient=${pat1.patient._id}&doctor=${docA.doctor._id}&limit=1&sort=date`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page1.body.records.map((r: any) => r._id)).toEqual([r1.body.record._id]);
    expect(page1.body.pagination.hasMore).toBe(true);
    const page2 = await request(app)
      .get(`/api/emr/records?patient=${pat1.patient._id}&doctor=${docA.doctor._id}&limit=1&sort=date&cursor=${page1.body.pagination.nextCursor}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(page2.body.records.map((r: any) => r._id)).toEqual([r2.body.record._id]);

    // A doctor asking for one patient gets only their own records of that patient
    // (patient partition + doctor filter), like the original { patient, doctor } filter.
    const docForPatient = await request(app)
      .get(`/api/emr/records?patient=${pat1.patient._id}`)
      .set('Authorization', `Bearer ${docB.token}`);
    expect(docForPatient.body.records.map((r: any) => r._id)).toEqual([r3.body.record._id]);

    // A doctor user without a Doctor profile is not restricted (original behaviour).
    const { token: noProfileDoctor } = await makeUser('doctor');
    const unrestricted = await request(app)
      .get(`/api/emr/records?patient=${pat1.patient._id}`)
      .set('Authorization', `Bearer ${noProfileDoctor}`);
    expect(unrestricted.body.records).toHaveLength(3);

    // Unfiltered staff list uses the hospital-wide index.
    const all = await request(app).get('/api/emr/records?limit=100').set('Authorization', `Bearer ${adminToken}`);
    expect(all.body.records.length).toBeGreaterThanOrEqual(4);
  });

  it('returns 404 / 400 / 403 on error paths', async () => {
    const { token: adminToken } = await makeUser('admin');
    const { token: patientToken, patient } = await makePatient();
    const notFound = await request(app).get('/api/emr/records/not-a-real-id').set('Authorization', `Bearer ${adminToken}`);
    expect(notFound.status).toBe(404);
    expect(notFound.body.message).toBe('Medical record not found');

    const invalid = await request(app).post('/api/emr/records').set('Authorization', `Bearer ${adminToken}`).send({ patient: 'x' });
    expect(invalid.status).toBe(400);

    const missingRef = await request(app)
      .post('/api/emr/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(recordBody(patient._id, 'unknown-doctor'));
    expect(missingRef.status).toBe(400);
    expect(missingRef.body.message).toBe('Doctor not found');

    const missingPatient = await request(app)
      .post('/api/emr/records')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(recordBody('unknown-patient', 'unknown-doctor'));
    expect(missingPatient.status).toBe(400);
    expect(missingPatient.body.message).toBe('Patient not found');

    // Real patient and doctor, so the 400 can only come from the invalid date.
    const dept = await makeDepartment();
    const { doctor } = await makeDoctor(dept._id);
    const badDate = await request(app).post('/api/emr/records').set('Authorization', `Bearer ${adminToken}`).send(recordBody(patient._id, doctor._id, { followUpDate: 'nope' }));
    expect(badDate.status).toBe(400);
    expect(badDate.body.message).toBe('Invalid followUpDate');

    const badCursor = await request(app).get('/api/emr/records?cursor=garbage').set('Authorization', `Bearer ${adminToken}`);
    expect(badCursor.status).toBe(400);

    const forbidden = await request(app).post('/api/emr/records').set('Authorization', `Bearer ${patientToken}`).send({});
    expect(forbidden.status).toBe(403);
  });
});

describe('prescriptions', () => {
  it('creates, lists (scoped) and fetches prescriptions', async () => {
    const dept = await makeDepartment();
    const { doctor, token: doctorToken } = await makeDoctor(dept._id, 'Dr. Rx');
    const { patient, token: patientToken } = await makePatient('Rx Patient');

    const res = await request(app).post('/api/emr/prescriptions').set('Authorization', `Bearer ${doctorToken}`).send(rxBody(patient._id, doctor._id));
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Prescription created');
    expect(res.body.prescription.prescriptionId).toMatch(/^RX-\d{4}-\d{5}$/);
    expect(res.body.prescription.status).toBe('active');
    expect(res.body.prescription.notes).toBe('');
    expect(res.body.prescription.patient).toEqual({ _id: patient._id, patientId: patient.patientId, name: 'Rx Patient' });

    const list = await request(app).get('/api/emr/prescriptions').set('Authorization', `Bearer ${patientToken}`);
    expect(list.status).toBe(200);
    expect(list.body.prescriptions).toHaveLength(1);
    expect(list.body.prescriptions[0].doctor).toMatchObject({ _id: doctor._id, name: 'Dr. Rx' });
    expect(list.body.pagination.count).toBe(1);

    // EMR and RX share the patient partition; the sort-key prefix keeps them apart.
    const records = await request(app).get('/api/emr/records').set('Authorization', `Bearer ${patientToken}`);
    expect(records.body.records).toHaveLength(0);

    const one = await request(app).get(`/api/emr/prescriptions/${res.body.prescription._id}`).set('Authorization', `Bearer ${patientToken}`);
    expect(one.status).toBe(200);
    expect(one.body.prescription.patient).toMatchObject({ allergies: [], bloodGroup: 'A+' });
    expect(one.body.prescription.patient.medicalHistory).toBeUndefined();

    const missing = await request(app).get('/api/emr/prescriptions/nope').set('Authorization', `Bearer ${patientToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Prescription not found');

    // Doctor scoping (GSI3 DOCTOR#<id>) and unique counter ids under concurrency.
    const other = await makeDoctor(dept._id, 'Dr. Other');
    const burst = await Promise.all(
      [1, 2, 3, 4].map(() => request(app).post('/api/emr/prescriptions').set('Authorization', `Bearer ${other.token}`).send(rxBody(patient._id, other.doctor._id)))
    );
    expect(burst.every((r) => r.status === 201)).toBe(true);
    expect(new Set(burst.map((r) => r.body.prescription.prescriptionId)).size).toBe(4);
    const mineAsDoctor = await request(app).get('/api/emr/prescriptions').set('Authorization', `Bearer ${doctorToken}`);
    expect(mineAsDoctor.body.prescriptions.map((p: any) => p._id)).toEqual([res.body.prescription._id]);
    const otherList = await request(app).get('/api/emr/prescriptions?limit=3').set('Authorization', `Bearer ${other.token}`);
    expect(otherList.body.prescriptions).toHaveLength(3);
    expect(otherList.body.pagination.hasMore).toBe(true);

    const empty = await request(app).post('/api/emr/prescriptions').set('Authorization', `Bearer ${doctorToken}`).send({ ...rxBody(patient._id, doctor._id), medicines: [] });
    expect(empty.status).toBe(400);
  });
});

describe('notifications', () => {
  it('lists newest first, filters unread, counts unread and marks read', async () => {
    const { user, token } = await makeUser('patient');
    const other = await makeUser('patient');
    const n1 = await createNotification({ recipient: user._id, title: 'One', message: 'm1' });
    await new Promise((r) => setTimeout(r, 5));
    const n2 = await createNotification({ recipient: user._id, title: 'Two', message: 'm2', type: 'lab' });
    await new Promise((r) => setTimeout(r, 5));
    const n3 = await createNotification({ recipient: user._id, title: 'Three', message: 'm3' });
    const foreign = await createNotification({ recipient: other.user._id, title: 'Other', message: 'x' });

    const all = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(all.status).toBe(200);
    expect(all.body.data.notifications.map((n: any) => n._id)).toEqual([n3._id, n2._id, n1._id]);
    expect(all.body.data.unreadCount).toBe(3);
    expect(all.body.data.notifications[0].GSI3PK).toBeUndefined();

    const limited = await request(app).get('/api/notifications?limit=2').set('Authorization', `Bearer ${token}`);
    expect(limited.body.data.notifications).toHaveLength(2);

    const read = await request(app).patch(`/api/notifications/${n2._id}/read`).set('Authorization', `Bearer ${token}`);
    expect(read.status).toBe(200);
    expect(read.body.data.notification).toMatchObject({ _id: n2._id, read: true });

    // Marking again is idempotent.
    const again = await request(app).patch(`/api/notifications/${n2._id}/read`).set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(200);

    const unread = await request(app).get('/api/notifications?unread=true').set('Authorization', `Bearer ${token}`);
    expect(unread.body.data.notifications.map((n: any) => n._id)).toEqual([n3._id, n1._id]);
    expect(unread.body.data.unreadCount).toBe(2);

    // Someone else's notification, or an unknown id, is "not found".
    const notMine = await request(app).patch(`/api/notifications/${foreign._id}/read`).set('Authorization', `Bearer ${token}`);
    expect(notMine.status).toBe(404);
    expect(notMine.body.message).toBe('Notification not found');
    const unknown = await request(app).patch('/api/notifications/unknown/read').set('Authorization', `Bearer ${token}`);
    expect(unknown.status).toBe(404);

    const allRead = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${token}`);
    expect(allRead.status).toBe(200);
    expect(allRead.body.message).toBe('All notifications marked as read');
    const after = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(after.body.data.unreadCount).toBe(0);
    expect(after.body.data.notifications.every((n: any) => n.read)).toBe(true);

    // The other user's notification is untouched.
    const otherList = await request(app).get('/api/notifications').set('Authorization', `Bearer ${other.token}`);
    expect(otherList.body.data.unreadCount).toBe(1);
  });

  it('tolerates mark-all racing with single mark-read requests', async () => {
    const { user, token } = await makeUser('doctor');
    const created = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => createNotification({ recipient: user._id, title: `N${i}`, message: 'x' })));
    const results = await Promise.all([
      request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${token}`),
      ...created.map((n) => request(app).patch(`/api/notifications/${n._id}/read`).set('Authorization', `Bearer ${token}`)),
      request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${token}`),
    ]);
    expect(results.map((r) => r.status).every((s) => s === 200)).toBe(true);
    // Every single mark-read response shows the notification as read, even if it lost the race.
    expect(results.slice(1, 7).every((r) => r.body.data.notification.read === true)).toBe(true);
    const after = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(after.body.data.unreadCount).toBe(0);
  });

  it('lets only admins create notifications', async () => {
    const { token: adminToken } = await makeUser('admin');
    const { user, token: userToken } = await makeUser('receptionist');

    const res = await request(app)
      .post('/api/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ recipient: user._id, title: 'Hello', message: 'World' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Notification sent');
    expect(res.body.data.notification).toMatchObject({ recipient: user._id, type: 'system', read: false, link: '' });

    const list = await request(app).get('/api/notifications?unread=true').set('Authorization', `Bearer ${userToken}`);
    expect(list.body.data.notifications).toHaveLength(1);

    const invalid = await request(app).post('/api/notifications').set('Authorization', `Bearer ${adminToken}`).send({ recipient: user._id });
    expect(invalid.status).toBe(400);
    const forbidden = await request(app).post('/api/notifications').set('Authorization', `Bearer ${userToken}`).send({ recipient: user._id, title: 't', message: 'm' });
    expect(forbidden.status).toBe(403);
  });
});
