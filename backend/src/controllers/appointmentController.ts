import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { appointmentRepo, departmentRepo, doctorRepo, patientRepo } from '../repositories';
import { findDoctorByUser, findPatientByUser } from '../repositories/profiles';
import { createNotification } from '../repositories/notifications';
import { Item, queryAll, queryCount, queryPage, QueryOptions, transactWrite, tx, TxOp } from '../db/dynamo';
import { slotLockKey, STATS, statsAdd, typePartition, patientPartition, doctorPartition } from '../db/keys';
import { populate } from '../db/populate';
import { AppointmentStatus, IAppointment } from '../types/entities';
import { createAppointmentSchema, updateAppointmentStatusSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { dayRangeIso, isoUpper, localDayKey, parseDate } from '../utils/dates';
import { isDescending, paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newAppointmentId, nextQueueNumber } from '../utils/ids';
import { ConflictError } from '../utils/errors';

// Double-booking protection:
// While an appointment is in an active status it owns a lock item
//   PK = SLOT#<doctorId>#<YYYY-MM-DD>#<timeSlot>
// written with attribute_not_exists in the same transaction as the appointment.
// A second booking of the same doctor/day/slot fails atomically (409), even
// when both requests arrive at the same moment. The lock is released when the
// appointment becomes cancelled / no_show / completed (the statuses the
// original conflict check ignored) or is deleted, and re-acquired if it
// becomes active again.

const INACTIVE_STATUSES: AppointmentStatus[] = ['cancelled', 'no_show', 'completed'];
const isActive = (status: AppointmentStatus) => !INACTIVE_STATUSES.includes(status);
const SLOT_TAKEN = 'This time slot is already booked. Please choose a different time.';

const lockFor = (a: Pick<IAppointment, 'doctor' | 'date' | 'timeSlot'>) => slotLockKey(a.doctor, localDayKey(a.date), a.timeSlot);

const acquireSlot = (a: IAppointment): TxOp =>
  tx.putUnique({ ...lockFor(a), entityType: 'SLOT', appointmentId: a._id }, SLOT_TAKEN);

const releaseSlot = (a: IAppointment): TxOp => {
  const k = lockFor(a);
  // Only delete the lock if this appointment owns it.
  return tx.delete(k.PK, k.SK, 'attribute_not_exists(PK) OR appointmentId = :id', { ':id': a._id });
};

const populateList = async (appointments: any[]) => {
  await Promise.all([
    populate(appointments, 'patient', patientRepo, ['patientId', 'name', 'email', 'phone']),
    populate(appointments, 'doctor', doctorRepo, ['doctorId', 'name', 'specialization', 'consultationFee', 'roomNumber', 'department']),
    populate(appointments, 'department', departmentRepo, ['name', 'code']),
  ]);
  await populate(appointments.map((a) => a.doctor), 'department', departmentRepo, ['name', 'code']);
};

const publicItems = (items: Item[]) => items.map((i) => appointmentRepo.toPublic(appointmentRepo.fromItem(i))) as any[];

export const getAppointments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = queryString(req.query.status);
    let doctor = queryString(req.query.doctor);
    let patient = queryString(req.query.patient);
    const department = queryString(req.query.department);
    const date = queryString(req.query.date);
    const dateFrom = queryString(req.query.dateFrom);
    const dateTo = queryString(req.query.dateTo);
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const descending = isDescending(req.query.sort, true);

    // Role-based filtering
    if (req.user?.role === 'patient') {
      const patientProfile = await findPatientByUser(req.user.id);
      if (patientProfile) patient = patientProfile._id;
    } else if (req.user?.role === 'doctor') {
      const doctorProfile = await findDoctorByUser(req.user.id);
      if (doctorProfile) doctor = doctorProfile._id;
    }

    // Date range (ISO strings); open ends use the lowest/highest possible values.
    let from = '';
    let to = '￿';
    if (date) [from, to] = dayRangeIso(parseDate(date));
    if (dateFrom || dateTo) {
      from = dateFrom ? parseDate(dateFrom, 'dateFrom').toISOString() : '';
      to = dateTo ? parseDate(dateTo, 'dateTo').toISOString() : '￿';
    }

    // Choose the most selective index: by patient, by doctor, or hospital-wide by date.
    let query: QueryOptions;
    if (patient) {
      query = { index: 'GSI2', pk: patientPartition(patient), sk: { between: [`APPT#${from}`, `APPT#${isoUpper(to)}`] } };
    } else if (doctor) {
      query = { index: 'GSI3', pk: doctorPartition(doctor), sk: { between: [`APPT#${from}`, `APPT#${isoUpper(to)}`] } };
    } else {
      query = { index: 'GSI1', pk: typePartition('APPT'), sk: { between: [from, isoUpper(to)] } };
    }

    const { items, nextCursor } = await queryPage({
      ...query,
      forward: !descending,
      limit,
      cursor,
      filter: (a) =>
        (!status || a.status === status) &&
        (!doctor || a.doctor === doctor) &&
        (!patient || a.patient === patient) &&
        (!department || a.department === department),
    });

    const appointments = publicItems(items);
    await populateList(appointments);

    return res.json({
      success: true,
      appointments,
      pagination: paginationMeta(limit, appointments.length, nextCursor),
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const found = await appointmentRepo.get(req.params.id);
    const appointment: any = found ? appointmentRepo.toPublic(found) : null;
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    await Promise.all([
      populate([appointment], 'patient', patientRepo, ['patientId', 'name', 'email', 'phone', 'dob', 'gender', 'bloodGroup', 'allergies', 'medicalHistory']),
      populate([appointment], 'doctor', doctorRepo, ['doctorId', 'name', 'specialization', 'consultationFee', 'roomNumber', 'department']),
      populate([appointment], 'department', departmentRepo, ['name', 'code']),
    ]);
    await populate([appointment.doctor], 'department', departmentRepo, ['name', 'code']);
    return res.json({ success: true, appointment });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let body = { ...req.body };
    if (!body.patient && req.user) {
      const p = await findPatientByUser(req.user.id);
      if (p) body.patient = p._id;
    }
    // If doctor is passed by name instead of id
    if (typeof body.doctor === 'string' && body.doctor && !(await doctorRepo.get(body.doctor))) {
      const [doc] = await doctorRepo.search(body.doctor, 1);
      if (doc) body.doctor = doc._id;
    }
    // If department is passed by name instead of id (departments are a small catalog)
    if (typeof body.department === 'string' && body.department && !(await departmentRepo.get(body.department))) {
      const name = body.department.toLowerCase();
      const departments = await queryAll({ index: 'GSI1', pk: typePartition('DEPT') });
      const dept = departments.find((d) => String(d.name).toLowerCase().includes(name));
      if (dept) body.department = dept._id;
    }

    const data = createAppointmentSchema.parse(body);
    const appointmentDate = parseDate(data.date);

    const doctor = await doctorRepo.get(data.doctor);
    if (!doctor) return res.status(400).json({ success: false, message: 'Doctor not found' });

    const dayKey = localDayKey(appointmentDate);
    const [appointmentId, queueNumber] = await Promise.all([newAppointmentId(), nextQueueNumber(data.doctor, dayKey)]);

    const draft = {
      appointmentId,
      patient: data.patient,
      doctor: data.doctor,
      department: data.department,
      date: appointmentDate.toISOString(),
      timeSlot: data.timeSlot,
      symptoms: data.symptoms,
      status: 'pending' as AppointmentStatus,
      type: data.type,
      notes: data.notes ?? '',
      queueNumber,
    };
    const { entity: appointment, ops } = appointmentRepo.prepareCreate({ ...draft, slotLock: lockFor(draft).PK });

    // Appointment + slot lock + statistics are written atomically.
    await transactWrite([
      ...ops,
      acquireSlot(appointment),
      statsAdd(STATS.totals, { appointments: 1 }),
      statsAdd(STATS.appointmentsByDepartment(appointment.department), { count: 1 }),
    ]);

    // Create notification for doctor
    await createNotification({
      recipient: doctor.user,
      title: 'New Appointment Booked',
      message: `Appointment ${appointmentId} scheduled for ${appointmentDate.toLocaleDateString()} at ${data.timeSlot}`,
      type: 'appointment',
      link: `/doctor/appointments`,
    });

    await logAudit({
      user: req.user, action: 'APPOINTMENT_CREATED', entity: 'Appointment',
      entityId: appointment._id,
      description: `Appointment ${appointmentId} booked for ${appointmentDate.toLocaleDateString()}`,
      ipAddress: req.ip,
    });

    const populated: any = appointmentRepo.toPublic(appointment);
    await Promise.all([
      populate([populated], 'patient', patientRepo, ['patientId', 'name']),
      populate([populated], 'doctor', doctorRepo, ['doctorId', 'name', 'specialization']),
      populate([populated], 'department', departmentRepo, ['name', 'code']),
    ]);

    return res.status(201).json({ success: true, message: 'Appointment booked successfully', appointment: populated });
  } catch (error) {
    if (error instanceof ConflictError && error.message === SLOT_TAKEN) {
      return res.status(409).json({ success: false, message: SLOT_TAKEN });
    }
    next(error);
  }
};

export const updateAppointmentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateAppointmentStatusSchema.parse(req.body);
    let previousStatus: AppointmentStatus | undefined;

    const appointment = await appointmentRepo.update(
      req.params.id,
      (current) => {
        previousStatus = current.status;
        const patch: Partial<IAppointment> = { status: data.status };
        if (data.notes) patch.notes = data.notes;
        const wasActive = isActive(current.status);
        const willBeActive = isActive(data.status);
        if (wasActive && !willBeActive) patch.slotLock = undefined;
        if (!wasActive && willBeActive) patch.slotLock = lockFor(current).PK;
        return patch;
      },
      {
        extra: (current, next) => {
          const wasActive = isActive(current.status);
          const willBeActive = isActive(next.status);
          if (wasActive && !willBeActive) return [releaseSlot(current)];
          if (!wasActive && willBeActive) return [acquireSlot(current)];
          return [];
        },
      }
    );
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    // Notify patient on status change
    const patient = await patientRepo.get(appointment.patient);
    if (patient) {
      await createNotification({
        recipient: patient.user,
        title: 'Appointment Status Updated',
        message: `Your appointment ${appointment.appointmentId} has been updated to: ${data.status.replace('_', ' ')}`,
        type: 'appointment',
      });
    }

    await logAudit({
      user: req.user, action: 'APPOINTMENT_STATUS_CHANGED', entity: 'Appointment',
      entityId: appointment._id,
      description: `Appointment ${appointment.appointmentId} status: ${previousStatus} → ${data.status}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Appointment status updated', appointment: appointmentRepo.toPublic(appointment) });
  } catch (error) {
    if (error instanceof ConflictError && error.message === SLOT_TAKEN) {
      return res.status(409).json({ success: false, message: 'Cannot reactivate: ' + SLOT_TAKEN });
    }
    next(error);
  }
};

export const deleteAppointment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentRepo.remove(req.params.id, {
      extra: (current) => [
        ...(isActive(current.status) ? [releaseSlot(current)] : []),
        statsAdd(STATS.totals, { appointments: -1 }),
        statsAdd(STATS.appointmentsByDepartment(current.department), { count: -1 }),
      ],
    });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

    await logAudit({
      user: req.user, action: 'APPOINTMENT_DELETED', entity: 'Appointment',
      entityId: appointment._id,
      description: `Appointment ${appointment.appointmentId} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    next(error);
  }
};

// GET /api/appointments/stats — dashboard statistics
export const getAppointmentStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [dayStart, dayEnd] = dayRangeIso(new Date());
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const byDate = (from: string, to = '￿') => ({ index: 'GSI1' as const, pk: typePartition('APPT'), sk: { between: [from, isoUpper(to)] as [string, string] } });

    // Today's appointments are a small, date-bounded set; count statuses in memory.
    const [today, weekTotal, monthTotal] = await Promise.all([
      queryAll(byDate(dayStart, dayEnd)),
      queryCount(byDate(weekStart)),
      queryCount(byDate(monthStart)),
    ]);

    return res.json({
      success: true,
      stats: {
        todayTotal: today.length,
        todayCompleted: today.filter((a) => a.status === 'completed').length,
        todayPending: today.filter((a) => a.status === 'pending' || a.status === 'confirmed').length,
        weekTotal,
        monthTotal,
      },
    });
  } catch (error) {
    next(error);
  }
};
