import request from 'supertest';
import { setupTestTable, teardownTestTable } from './helpers/dynamoLocal';
import { makeDepartment, makeDoctor, makePatient, makeUser } from './helpers/factory';
import type { Application } from 'express';

let app: Application;
let table: string;
let admin: string;

beforeAll(async () => {
  table = await setupTestTable();
  app = (await import('../src/app')).default;
  admin = (await makeUser('admin')).token;
});
afterAll(() => teardownTestTable(table));

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const patientBody = (email: string, name = 'Jane Doe') => ({
  name,
  email,
  phone: '555-1234',
  dob: '1985-05-20',
  gender: 'female',
  bloodGroup: 'B+',
  address: '42 Main Street',
  emergencyContact: { name: 'John', relationship: 'Spouse', phone: '555-9999' },
});

describe('departments', () => {
  it('creates, lists with search/limit/cursor, updates and deletes; guards name and code', async () => {
    const created = await request(app).post('/api/departments').set(auth(admin))
      .send({ name: 'Zeta Radiology', code: 'zrad', description: 'Imaging and scans' });
    expect(created.status).toBe(201);
    expect(created.body.department).toMatchObject({ name: 'Zeta Radiology', code: 'ZRAD', icon: 'Stethoscope', status: 'active' });
    expect(created.body.department.PK).toBeUndefined();
    const id = created.body.department._id;

    // Duplicate name (case-insensitive) or code -> original 400 message
    const dupName = await request(app).post('/api/departments').set(auth(admin))
      .send({ name: 'zeta radiology', code: 'OTHER', description: 'Imaging and scans' });
    expect(dupName.status).toBe(400);
    expect(dupName.body.message).toBe('Department name or code already exists');
    const dupCode = await request(app).post('/api/departments').set(auth(admin))
      .send({ name: 'Another', code: 'ZRAD', description: 'Imaging and scans' });
    expect(dupCode.status).toBe(400);

    await request(app).post('/api/departments').set(auth(admin)).send({ name: 'Zeta Surgery', code: 'ZSUR', description: 'Surgery dept' });
    await request(app).post('/api/departments').set(auth(admin)).send({ name: 'Zeta Urology', code: 'ZURO', description: 'Urology dept' });

    const search = await request(app).get('/api/departments?search=zsu');
    expect(search.status).toBe(200);
    expect(search.body.departments.map((d: any) => d.name)).toEqual(['Zeta Surgery']);

    const page1 = await request(app).get('/api/departments?search=zeta&limit=2');
    expect(page1.body.departments.map((d: any) => d.name)).toEqual(['Zeta Radiology', 'Zeta Surgery']); // sorted by name
    expect(page1.body.pagination).toMatchObject({ limit: 2, count: 2, hasMore: true });
    const page2 = await request(app).get(`/api/departments?search=zeta&limit=2&cursor=${page1.body.pagination.nextCursor}`);
    expect(page2.body.departments.map((d: any) => d.name)).toEqual(['Zeta Urology']);
    expect(page2.body.pagination.hasMore).toBe(false);

    // Rename: new name taken -> 400; free name -> ok and old name becomes free
    const taken = await request(app).put(`/api/departments/${id}`).set(auth(admin)).send({ name: 'Zeta Surgery' });
    expect(taken.status).toBe(400);
    const renamed = await request(app).put(`/api/departments/${id}`).set(auth(admin)).send({ name: 'Zeta Imaging', code: 'zimg' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.department).toMatchObject({ name: 'Zeta Imaging', code: 'ZIMG', description: 'Imaging and scans' });
    const reuse = await request(app).post('/api/departments').set(auth(admin))
      .send({ name: 'Zeta Radiology', code: 'ZRAD', description: 'Reused name and code' });
    expect(reuse.status).toBe(201);

    const del = await request(app).delete(`/api/departments/${id}`).set(auth(admin));
    expect(del.status).toBe(200);
    expect((await request(app).get(`/api/departments/${id}`)).status).toBe(404);
    // Name/code released on delete
    const again = await request(app).post('/api/departments').set(auth(admin))
      .send({ name: 'Zeta Imaging', code: 'ZIMG', description: 'Created again' });
    expect(again.status).toBe(201);
  });

  it('lets only one of several concurrent creates with the same code win', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        request(app).post('/api/departments').set(auth(admin)).send({ name: `Race Dept ${i}`, code: 'RACE', description: 'Concurrent create' })
      )
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 400)).toHaveLength(3);
  });

  it('lets only one of two concurrent renames to the same name win', async () => {
    const a = await request(app).post('/api/departments').set(auth(admin)).send({ name: 'Rename A', code: 'RENA', description: 'Rename race' });
    const b = await request(app).post('/api/departments').set(auth(admin)).send({ name: 'Rename B', code: 'RENB', description: 'Rename race' });
    const results = await Promise.all(
      [a, b].map((d) => request(app).put(`/api/departments/${d.body.department._id}`).set(auth(admin)).send({ name: 'Rename Target' }))
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const list = await request(app).get('/api/departments?search=rename');
    expect(list.body.departments.filter((d: any) => d.name === 'Rename Target')).toHaveLength(1);
    // The loser's old name is still guarded (its transaction was rolled back)
    const loser = results.findIndex((r) => r.status === 400);
    const loserName = loser === 0 ? 'Rename A' : 'Rename B';
    const dup = await request(app).post('/api/departments').set(auth(admin)).send({ name: loserName, code: 'RENC', description: 'Rename race' });
    expect(dup.status).toBe(400);
  });

  it('returns 404 for unknown ids and 400 for invalid bodies', async () => {
    expect((await request(app).put('/api/departments/nope').set(auth(admin)).send({ name: 'Whatever' })).status).toBe(404);
    expect((await request(app).delete('/api/departments/nope').set(auth(admin))).status).toBe(404);
    expect((await request(app).post('/api/departments').set(auth(admin)).send({ name: 'X' })).status).toBe(400);
  });
});

describe('patients', () => {
  it('creates a patient with user account, lists, searches, filters, updates (syncing user) and deletes', async () => {
    const created = await request(app).post('/api/patients').set(auth(admin)).send(patientBody('Jane.Doe@Example.com', 'Jane Quincy'));
    expect(created.status).toBe(201);
    const patient = created.body.patient;
    expect(patient.patientId).toMatch(/^P-\d{4}-\d{4}$/);
    expect(patient.dob).toBe(new Date('1985-05-20').toISOString());
    expect(patient.insuranceProvider).toBe('');

    // The user account can log in with the default password
    const login = await request(app).post('/api/auth/login').send({ email: 'jane.doe@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('patient');

    const dup = await request(app).post('/api/patients').set(auth(admin)).send(patientBody('jane.doe@example.com'));
    expect(dup.status).toBe(400);
    expect(dup.body.message).toBe('Email is already registered');

    const byId = await request(app).get(`/api/patients/${patient._id}`).set(auth(admin));
    expect(byId.status).toBe(200);
    expect(byId.body.patient.user).toMatchObject({ _id: patient.user, email: 'jane.doe@example.com', role: 'patient', isActive: true });
    expect(byId.body.patient.user.password).toBeUndefined();

    const search = await request(app).get('/api/patients?search=quin').set(auth(admin));
    expect(search.body.patients.map((p: any) => p._id)).toEqual([patient._id]);
    expect(search.body.patients[0].user.name).toBe('Jane Quincy');
    const byPid = await request(app).get(`/api/patients?search=${patient.patientId}`).set(auth(admin));
    expect(byPid.body.patients).toHaveLength(1);
    const wrongGroup = await request(app).get('/api/patients?search=quin&bloodGroup=O-').set(auth(admin));
    expect(wrongGroup.body.patients).toHaveLength(0);

    const list = await request(app).get('/api/patients?limit=100&bloodGroup=B%2B').set(auth(admin));
    expect(list.status).toBe(200);
    expect(list.body.patients[0]._id).toBe(patient._id); // newest first
    expect(list.body.pagination).toMatchObject({ limit: 100 });

    const upd = await request(app).put(`/api/patients/${patient._id}`).set(auth(admin)).send({ name: 'Jane Zephyr', phone: '555-7777' });
    expect(upd.status).toBe(200);
    expect(upd.body.patient).toMatchObject({ name: 'Jane Zephyr', phone: '555-7777', address: '42 Main Street', bloodGroup: 'B+' });
    const me = await request(app).get('/api/auth/me').set(auth(login.body.token));
    expect(me.body.user).toMatchObject({ name: 'Jane Zephyr', phone: '555-7777' });
    // Search tokens follow the rename
    expect((await request(app).get('/api/patients?search=quincy').set(auth(admin))).body.patients).toHaveLength(0);
    expect((await request(app).get('/api/patients?search=zephyr').set(auth(admin))).body.patients).toHaveLength(1);

    const badDob = await request(app).put(`/api/patients/${patient._id}`).set(auth(admin)).send({ dob: 'not-a-date' });
    expect(badDob.status).toBe(400);

    const del = await request(app).delete(`/api/patients/${patient._id}`).set(auth(admin));
    expect(del.status).toBe(200);
    expect((await request(app).get(`/api/patients/${patient._id}`).set(auth(admin))).status).toBe(404);
    expect((await request(app).delete(`/api/patients/${patient._id}`).set(auth(admin))).status).toBe(404);
  });

  it('creates unique patient ids and only one account for concurrent same-email requests', async () => {
    const distinct = await Promise.all([1, 2, 3].map((i) => request(app).post('/api/patients').set(auth(admin)).send(patientBody(`par${i}@x.com`))));
    const ids = distinct.map((r) => r.body.patient.patientId);
    expect(new Set(ids).size).toBe(3);

    const same = await Promise.all([1, 2, 3].map(() => request(app).post('/api/patients').set(auth(admin)).send(patientBody('same@x.com'))));
    const statuses = same.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 400)).toHaveLength(2);
  });

  it('keeps STATS totals.patients in step with creates/deletes, also under a same-email race', async () => {
    const { getItem } = await import('../src/db/dynamo');
    const { STATS } = await import('../src/db/keys');
    const totalPatients = async () => Number((await getItem(STATS.totals.PK, STATS.totals.SK))?.patients ?? 0);

    const before = await totalPatients();
    const created = await request(app).post('/api/patients').set(auth(admin)).send(patientBody('stats@x.com'));
    expect(created.status).toBe(201);
    expect(await totalPatients()).toBe(before + 1);

    // 5 simultaneous creates with one email: exactly one account, one counter increment, no 409/500
    const race = await Promise.all([1, 2, 3, 4, 5].map(() => request(app).post('/api/patients').set(auth(admin)).send(patientBody('race5@x.com', 'Racer Five'))));
    expect(race.map((r) => r.status).sort()).toEqual([201, 400, 400, 400, 400]);
    expect(race.filter((r) => r.status === 400).every((r) => r.body.message === 'Email is already registered')).toBe(true);
    expect(await totalPatients()).toBe(before + 2);
    expect((await request(app).get('/api/patients?search=race5@x.com').set(auth(admin))).body.patients).toHaveLength(1);

    expect((await request(app).delete(`/api/patients/${created.body.patient._id}`).set(auth(admin))).status).toBe(200);
    expect(await totalPatients()).toBe(before + 1);
    // A failed delete (unknown id) does not touch the counter
    expect((await request(app).delete(`/api/patients/${created.body.patient._id}`).set(auth(admin))).status).toBe(404);
    expect(await totalPatients()).toBe(before + 1);
  });

  it('fills a filtered search page even when other matches do not pass the filter', async () => {
    for (const [i, group] of [[1, 'B+'], [2, 'B+'], [3, 'O-'], [4, 'O-'], [5, 'B+'], [6, 'O-']] as const) {
      const r = await request(app).post('/api/patients').set(auth(admin)).send({ ...patientBody(`fill${i}@x.com`, `Fillpage Person${i}`), bloodGroup: group });
      expect(r.status).toBe(201);
    }
    const res = await request(app).get('/api/patients?search=fillpage&bloodGroup=O-&limit=2').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.patients).toHaveLength(2);
    expect(res.body.patients.every((p: any) => p.bloodGroup === 'O-')).toBe(true);
    expect((await request(app).get('/api/patients?search=fillpage&gender=female&limit=10').set(auth(admin))).body.patients).toHaveLength(6);
  });

  it('builds the timeline from the patient partition with original populates and sorting', async () => {
    const { appointmentRepo, medicalRecordRepo, labReportRepo, labTestRepo, prescriptionRepo, billRepo } = await import('../src/repositories');
    const dept = await makeDepartment();
    const { doctor } = await makeDoctor(dept._id, 'Dr. Timeline');
    const { patient } = await makePatient('Timeline Patient');
    const test = await labTestRepo.create({ testCode: 'LT-T1', name: 'CBC', category: 'Hematology', price: 10, description: '', normalRange: '', turnaroundHours: 4 });

    await appointmentRepo.create({ appointmentId: 'APT-T-1', patient: patient._id, doctor: doctor._id, department: dept._id, date: '2030-01-10T00:00:00.000Z', timeSlot: '9', symptoms: 'x', status: 'pending', type: 'in_person', notes: '', queueNumber: 1 });
    await prescriptionRepo.create({ prescriptionId: 'RX-T-1', patient: patient._id, doctor: doctor._id, date: '2031-01-01T00:00:00.000Z', medicines: [], status: 'active', notes: '' });
    await medicalRecordRepo.create({ recordId: 'EMR-T-1', patient: patient._id, doctor: doctor._id, date: '2020-01-01T00:00:00.000Z', symptoms: 's', diagnosis: 'd', clinicalNotes: '', vitals: { bloodPressure: '1', heartRate: 1, temperature: 1, oxygenSaturation: 1, weight: 1, height: 1 }, attachments: [] });
    await labReportRepo.create({ reportId: 'LAB-T-1', patient: patient._id, doctor: doctor._id, labTest: test._id, requestedDate: '2020-01-01T00:00:00.000Z', status: 'requested', results: [], reportFile: '', notes: '' });
    await billRepo.create({ billId: 'INV-T-1', patient: patient._id, items: [], subtotal: 0, discount: 0, tax: 0, totalAmount: 0, paidAmount: 0, balance: 0, status: 'pending', invoiceDate: '2020-01-01T00:00:00.000Z', dueDate: '2020-01-01T00:00:00.000Z' });

    const res = await request(app).get(`/api/patients/${patient._id}/timeline`).set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.patient._id).toBe(patient._id);
    const timeline = res.body.data.timeline;
    // Bills are not part of the timeline; newest first by date
    // RX dated 2031, appointment 2030, then the lab report and record by createdAt (lab created last)
    expect(timeline.map((t: any) => t.type)).toEqual(['prescription', 'appointment', 'lab_report', 'medical_record']);
    expect(timeline[0].data.doctor).toEqual({ _id: doctor._id, name: 'Dr. Timeline' });
    expect(timeline[1].data.doctor).toEqual({ _id: doctor._id, name: 'Dr. Timeline', specialization: 'Cardiology' });
    const lab = timeline.find((t: any) => t.type === 'lab_report');
    expect(lab.data.labTest).toEqual({ _id: test._id, name: 'CBC', category: 'Hematology' });
    expect(timeline.find((t: any) => t.type === 'medical_record').data.doctor.specialization).toBe('Cardiology');

    expect((await request(app).get('/api/patients/missing/timeline').set(auth(admin))).status).toBe(404);
  });

  it('rejects invalid bodies with 400 and unknown ids with 404', async () => {
    expect((await request(app).post('/api/patients').set(auth(admin)).send({ name: 'A' })).status).toBe(400);
    expect((await request(app).post('/api/patients').set(auth(admin)).send({ ...patientBody('baddob@x.com'), dob: 'garbage' })).status).toBe(400);
    expect((await request(app).put('/api/patients/missing').set(auth(admin)).send({ name: 'Nobody' })).status).toBe(404);
    expect((await request(app).get('/api/patients/missing').set(auth(admin))).status).toBe(404);
  });
});

describe('doctors', () => {
  const doctorBody = (email: string, department: string, overrides: Record<string, any> = {}) => ({
    name: 'Dr. Gregory House',
    email,
    phone: '555-4321',
    specialization: 'Diagnostic Medicine',
    department,
    qualification: 'MD',
    experienceYears: 20,
    consultationFee: 300,
    availableDays: ['Monday', 'Tuesday'],
    availableTimeSlots: [{ start: '09:00', end: '12:00' }],
    roomNumber: '221B',
    ...overrides,
  });

  it('creates, lists by department/specialization/status, searches, updates and deletes', async () => {
    const deptA = await makeDepartment('Doc Dept A', 'DOCA');
    const deptB = await makeDepartment('Doc Dept B', 'DOCB');

    const created = await request(app).post('/api/doctors').set(auth(admin)).send(doctorBody('house@x.com', deptA._id));
    expect(created.status).toBe(201);
    const doc = created.body.doctor;
    expect(doc).toMatchObject({ rating: 4.8, status: 'active', bio: '', department: deptA._id });
    expect(doc.doctorId).toMatch(/^D-\d{4}-\d{4}$/);
    const login = await request(app).post('/api/auth/login').send({ email: 'house@x.com', password: 'password123' });
    expect(login.body.user.role).toBe('doctor');

    const other = await request(app).post('/api/doctors').set(auth(admin))
      .send(doctorBody('wilson@x.com', deptB._id, { name: 'Dr. James Wilson', specialization: 'Oncology' }));
    expect(other.status).toBe(201);

    const dup = await request(app).post('/api/doctors').set(auth(admin)).send(doctorBody('HOUSE@x.com', deptA._id));
    expect(dup.status).toBe(400);
    expect(dup.body.message).toBe('Email is already registered');
    const badDept = await request(app).post('/api/doctors').set(auth(admin)).send(doctorBody('nodept@x.com', 'missing-dept'));
    expect(badDept.status).toBe(400);

    const byDept = await request(app).get(`/api/doctors?department=${deptA._id}`);
    expect(byDept.status).toBe(200);
    expect(byDept.body.doctors.map((d: any) => d._id)).toEqual([doc._id]);
    expect(byDept.body.doctors[0].department).toEqual({ _id: deptA._id, name: 'Doc Dept A', code: 'DOCA' });

    const bySpec = await request(app).get('/api/doctors?specialization=ncolo&limit=100');
    expect(bySpec.body.doctors.map((d: any) => d._id)).toEqual([other.body.doctor._id]);
    expect((await request(app).get('/api/doctors?status=on_leave&limit=100')).body.doctors.filter((d: any) => d._id === doc._id)).toHaveLength(0);

    const search = await request(app).get('/api/doctors?search=greg hou');
    expect(search.body.doctors.map((d: any) => d._id)).toEqual([doc._id]);
    expect((await request(app).get(`/api/doctors?search=${doc.doctorId}`)).body.doctors).toHaveLength(1);

    const byId = await request(app).get(`/api/doctors/${doc._id}`);
    expect(byId.body.doctor.department).toEqual({ _id: deptA._id, name: 'Doc Dept A', code: 'DOCA', description: 'Test department' });

    const slots = await request(app).get(`/api/doctors/${doc._id}/slots`);
    expect(slots.body.data).toEqual({ availableDays: ['Monday', 'Tuesday'], availableTimeSlots: [{ start: '09:00', end: '12:00' }] });

    // Move to department B, rename (user synced)
    const upd = await request(app).put(`/api/doctors/${doc._id}`).set(auth(admin)).send({ department: deptB._id, name: 'Dr. G. House', phone: '555-0000' });
    expect(upd.status).toBe(200);
    expect(upd.body.doctor.department).toMatchObject({ _id: deptB._id, name: 'Doc Dept B', code: 'DOCB', status: 'active' });
    expect(upd.body.doctor.consultationFee).toBe(300);
    const me = await request(app).get('/api/auth/me').set(auth(login.body.token));
    expect(me.body.user).toMatchObject({ name: 'Dr. G. House', phone: '555-0000' });
    expect((await request(app).get(`/api/doctors?department=${deptA._id}`)).body.doctors).toHaveLength(0);
    expect((await request(app).get(`/api/doctors?department=${deptB._id}`)).body.doctors).toHaveLength(2);

    const del = await request(app).delete(`/api/doctors/${doc._id}`).set(auth(admin));
    expect(del.status).toBe(200);
    expect((await request(app).get(`/api/doctors/${doc._id}`)).status).toBe(404);
    expect((await request(app).get(`/api/doctors/${doc._id}/slots`)).status).toBe(404);
    expect((await request(app).delete(`/api/doctors/${doc._id}`).set(auth(admin))).status).toBe(404);
  });

  it('creates only one doctor account for concurrent same-email requests', async () => {
    const dept = await makeDepartment('Race Doc Dept', 'RDOC');
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/doctors').set(auth(admin)).send(doctorBody('racedoc@x.com', dept._id))));
    expect(results.map((r) => r.status).sort()).toEqual([201, 400, 400]);
    expect((await request(app).get(`/api/doctors?department=${dept._id}`)).body.doctors).toHaveLength(1);
  });

  it('paginates with a cursor and returns 400 for a bad cursor', async () => {
    const dept = await makeDepartment('Paging Dept', 'PAGE');
    for (let i = 0; i < 3; i++) await makeDoctor(dept._id, `Dr. Pager ${i}`);
    const p1 = await request(app).get(`/api/doctors?department=${dept._id}&limit=2`);
    expect(p1.body.doctors).toHaveLength(2);
    expect(p1.body.pagination.hasMore).toBe(true);
    const p2 = await request(app).get(`/api/doctors?department=${dept._id}&limit=2&cursor=${p1.body.pagination.nextCursor}`);
    expect(p2.body.doctors).toHaveLength(1);
    expect(p2.body.doctors[0]._id).not.toBe(p1.body.doctors[0]._id);
    expect((await request(app).get('/api/doctors?cursor=garbage')).status).toBe(400);
  });

  it('returns 404/400 for unknown ids and invalid bodies', async () => {
    expect((await request(app).get('/api/doctors/missing')).status).toBe(404);
    expect((await request(app).put('/api/doctors/missing').set(auth(admin)).send({ name: 'Dr. Nobody' })).status).toBe(404);
    expect((await request(app).post('/api/doctors').set(auth(admin)).send({ name: 'Dr. X' })).status).toBe(400);
  });
});
