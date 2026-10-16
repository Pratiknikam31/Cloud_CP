import request from 'supertest';
import { setupTestTable, teardownTestTable } from './helpers/dynamoLocal';
import { makeDepartment, makeDoctor, makePatient, makeUser } from './helpers/factory';
import type { Express } from 'express';

let app: Express;
let table: string;

beforeAll(async () => {
  table = await setupTestTable();
  app = (await import('../src/app')).default;
});
afterAll(() => teardownTestTable(table));

describe('appointment booking', () => {
  it('books an appointment for the logged-in patient and returns populated refs', async () => {
    const dept = await makeDepartment('Cardiology A', 'CARDA');
    const { doctor } = await makeDoctor(dept._id, 'Dr. Alice Heart');
    const { patient, token } = await makePatient('Bob Patient');

    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctor: doctor._id, department: dept._id, date: '2030-01-15', timeSlot: '09:00 AM', symptoms: 'Chest pain' });

    expect(res.status).toBe(201);
    expect(res.body.appointment.appointmentId).toMatch(/^APT-\d{4}-\d{5}$/);
    expect(res.body.appointment.patient).toMatchObject({ _id: patient._id, name: 'Bob Patient' });
    expect(res.body.appointment.doctor).toMatchObject({ _id: doctor._id, name: 'Dr. Alice Heart' });
    expect(res.body.appointment.department).toMatchObject({ _id: dept._id, code: 'CARDA' });
    expect(res.body.appointment.queueNumber).toBe(1);
    expect(res.body.appointment.slotLock).toBeUndefined();

    const list = await request(app).get('/api/appointments?limit=5').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.appointments).toHaveLength(1);
    expect(list.body.appointments[0].doctor.department).toMatchObject({ _id: dept._id, name: 'Cardiology A' });
  });

  it('allows only one of many concurrent bookings of the same slot', async () => {
    const dept = await makeDepartment('Neurology B', 'NEURB');
    const { doctor } = await makeDoctor(dept._id, 'Dr. Brain');
    const patients = await Promise.all([1, 2, 3, 4, 5].map((i) => makePatient(`Concurrent ${i}`)));

    const results = await Promise.all(
      patients.map(({ token }) =>
        request(app)
          .post('/api/appointments')
          .set('Authorization', `Bearer ${token}`)
          .send({ doctor: doctor._id, department: dept._id, date: '2030-02-01', timeSlot: '10:00 AM', symptoms: 'Headache' })
      )
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    expect(results.find((r) => r.status === 409)!.body.message).toMatch(/already booked/);
  });

  it('frees the slot on cancellation and refuses to reactivate when re-booked', async () => {
    const dept = await makeDepartment('Ortho C', 'ORTHC');
    const { doctor } = await makeDoctor(dept._id);
    const first = await makePatient('First');
    const second = await makePatient('Second');
    const { token: staffToken } = await makeUser('receptionist');
    const body = { doctor: doctor._id, department: dept._id, date: '2030-03-01', timeSlot: '11:00 AM', symptoms: 'Knee pain' };

    const a = await request(app).post('/api/appointments').set('Authorization', `Bearer ${first.token}`).send(body);
    expect(a.status).toBe(201);
    const blocked = await request(app).post('/api/appointments').set('Authorization', `Bearer ${second.token}`).send(body);
    expect(blocked.status).toBe(409);

    const cancel = await request(app)
      .patch(`/api/appointments/${a.body.appointment._id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.appointment.status).toBe('cancelled');

    const b = await request(app).post('/api/appointments').set('Authorization', `Bearer ${second.token}`).send(body);
    expect(b.status).toBe(201);

    const revive = await request(app)
      .patch(`/api/appointments/${a.body.appointment._id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'confirmed' });
    expect(revive.status).toBe(409);
  });

  it('returns 400 (not 500) for invalid input and 404 for unknown ids', async () => {
    const { token } = await makePatient('Validator');
    const bad = await request(app).post('/api/appointments').set('Authorization', `Bearer ${token}`).send({});
    expect(bad.status).toBe(400);
    const missing = await request(app).get('/api/appointments/does-not-exist').set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });
});

describe('auth', () => {
  it('registers, logs in and reads /me; rejects duplicate emails case-insensitively', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Reg User', email: 'Reg.User@Example.com', password: 'secret123', role: 'patient' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe('reg.user@example.com');

    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'reg.user@EXAMPLE.com', password: 'secret123' });
    expect(dup.status).toBe(400);

    const login = await request(app).post('/api/auth/login').send({ email: 'REG.user@example.com', password: 'secret123' });
    expect(login.status).toBe(200);
    const bad = await request(app).post('/api/auth/login').send({ email: 'reg.user@example.com', password: 'wrong' });
    expect(bad.status).toBe(401);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.password).toBeUndefined();
    expect(me.body.profile.patientId).toMatch(/^P-\d{4}-\d{4}$/);
  });

  it('treats hospital_admin as admin for admin-only routes', async () => {
    const { token } = await makeUser('hospital_admin');
    const res = await request(app).delete('/api/appointments/unknown-id').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404); // reached the controller, i.e. not 403
  });
});
