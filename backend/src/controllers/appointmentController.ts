import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { appointmentRepo, departmentRepo, doctorRepo, patientRepo } from '../repositories';
import { findDoctorByUser, findPatientByUser } from '../repositories/profiles';
import { createNotification } from '../repositories/notifications';
import { canAccessPatientResource } from '../middleware/ownership';
import { Item, queryAll, queryCount, queryPage, QueryOptions, transactWrite, tx, TxOp } from '../db/dynamo';
import { slotLockKey, patientSlotLockKey, STATS, statsAdd, typePartition, patientPartition, doctorPartition } from '../db/keys';
import { populate } from '../db/populate';
import { AppointmentStatus, IAppointment } from '../types/entities';
import { createAppointmentSchema, updateAppointmentStatusSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { dayRangeIso, isoUpper, localDayKey, parseDate } from '../utils/dates';
import { isDescending, paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newAppointmentId, nextQueueNumber } from '../utils/ids';
import { ConflictError } from '../utils/errors';

// Double-booking protection:
// While an appointment is in an active status it owns a doctor lock item
//   PK = SLOT#<doctorId>#<YYYY-MM-DD>#<timeSlot>
// and a patient lock item
//   PK = PATIENT_SLOT#<patientId>#<YYYY-MM-DD>#<timeSlot>
// written with attribute_not_exists in the same transaction as the appointment.
// A second booking of the same doctor/day/slot OR of the same patient/day/slot fails atomically (409).
// The locks are released when the appointment becomes cancelled / no_show / completed or is deleted.

const INACTIVE_STATUSES: AppointmentStatus[] = ['cancelled', 'no_show', 'completed'];
const isActive = (status: AppointmentStatus) => !INACTIVE_STATUSES.includes(status);
const SLOT_TAKEN = 'This time slot is already booked. Please choose a different time.';
const PATIENT_SLOT_TAKEN = 'You already have an appointment scheduled for this time slot on this date.';

export const normalizeSlot = (slot: string): string => {
  if (!slot) return '';
  const clean = slot.trim().toUpperCase();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    const h = ampmMatch[1].padStart(2, '0');
    return `${h}:${ampmMatch[2]} ${ampmMatch[3]}`;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = match24[2];
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  }
  return clean;
};

const lockFor = (a: Pick<IAppointment, 'doctor' | 'date' | 'timeSlot'>) =>
  slotLockKey(a.doctor, localDayKey(a.date), normalizeSlot(a.timeSlot));

const acquireSlot = (a: IAppointment): TxOp =>
  tx.putUnique({ ...lockFor(a), entityType: 'SLOT', appointmentId: a._id }, SLOT_TAKEN);

const releaseSlot = (a: IAppointment): TxOp => {
  const k = lockFor(a);
  // Only delete the lock if this appointment owns it.
  return tx.delete(k.PK, k.SK, 'attribute_not_exists(PK) OR appointmentId = :id', { ':id': a._id });
};

const patientLockFor = (a: Pick<IAppointment, 'patient' | 'date' | 'timeSlot'>) =>
  patientSlotLockKey(a.patient, localDayKey(a.date), normalizeSlot(a.timeSlot));

const acquirePatientSlot = (a: IAppointment): TxOp =>
  tx.putUnique({ ...patientLockFor(a), entityType: 'PATIENT_SLOT', appointmentId: a._id }, PATIENT_SLOT_TAKEN);

const releasePatientSlot = (a: IAppointment): TxOp => {
  const k = patientLockFor(a);
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

    // Role-based filtering: If a patient or doctor has no profile, never return hospital-wide data!
    if (req.user?.role === 'patient') {
      const patientProfile = await findPatientByUser(req.user.id);
      if (!patientProfile) {
        return res.json({ success: true, appointments: [], pagination: paginationMeta(limit, 0, undefined) });
      }
      patient = patientProfile._id;
    } else if (req.user?.role === 'doctor') {
      const doctorProfile = await findDoctorByUser(req.user.id);
      if (req.query.doctor) {
        doctor = queryString(req.query.doctor);
      } else if (req.query.all === 'true') {
        doctor = undefined;
      } else if (doctorProfile) {
        doctor = doctorProfile._id;
      } else {
        return res.json({ success: true, appointments: [], pagination: paginationMeta(limit, 0, undefined) });
      }
    }

    // Date range (ISO strings); open ends use the lowest/highest possible values.
    let from = '';
    let to = '';
    if (date) [from, to] = dayRangeIso(parseDate(date));
    if (dateFrom || dateTo) {
      from = dateFrom ? parseDate(dateFrom, 'dateFrom').toISOString() : '';
      to = dateTo ? parseDate(dateTo, 'dateTo').toISOString() : '';
    }
    // When no date bounds are set, use full open range to avoid empty-string
    // BETWEEN conditions cutting off valid records.
    const hasDateBound = !!(date || dateFrom || dateTo);

    // Choose the most selective index: by patient, by doctor, or hospital-wide by date.
    let query: QueryOptions;
    if (patient) {
      if (hasDateBound) {
        query = { index: 'GSI2', pk: patientPartition(patient), sk: { between: [`APPT#${from}`, `APPT#${isoUpper(to)}`] } };
      } else {
        query = { index: 'GSI2', pk: patientPartition(patient), sk: { beginsWith: 'APPT#' } };
      }
    } else if (doctor) {
      if (hasDateBound) {
        query = { index: 'GSI3', pk: doctorPartition(doctor), sk: { between: [`APPT#${from}`, `APPT#${isoUpper(to)}`] } };
      } else {
        query = { index: 'GSI3', pk: doctorPartition(doctor), sk: { beginsWith: 'APPT#' } };
      }
    } else if (hasDateBound) {
      query = { index: 'GSI1', pk: typePartition('APPT'), sk: { between: [from, isoUpper(to)] } };
    } else {
      query = { index: 'GSI1', pk: typePartition('APPT') };
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

    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Access control:
    if (req.user.role === 'patient') {
      const p = await findPatientByUser(req.user.id);
      if (!p || p._id !== appointment.patient) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only view your own appointments' });
      }
    } else if (req.user.role === 'doctor') {
      const d = await findDoctorByUser(req.user.id);
      if (!d) {
        return res.status(403).json({ success: false, message: 'Access denied: Doctor profile not found' });
      }
    }

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

    // Force patient identity for patients (APPT-05: prevents booking for another patient)
    if (req.user?.role === 'patient') {
      const p = await findPatientByUser(req.user.id);
      if (!p) {
        return res.status(403).json({ success: false, message: 'Patient profile not found for authenticated user' });
      }
      body.patient = p._id;
    } else {
      // Staff (Receptionist / Admin) booking: patient must be specified and must exist (APPT-07, APPT-08)
      if (!body.patient) {
        return res.status(400).json({ success: false, message: 'patient: Required' });
      }
      const existingPatient = await patientRepo.get(body.patient);
      if (!existingPatient) {
        return res.status(400).json({ success: false, message: 'Patient not found' });
      }
    }

    // If doctor is passed by name instead of id
    if (typeof body.doctor === 'string' && body.doctor && !(await doctorRepo.get(body.doctor))) {
      const [doc] = await doctorRepo.search(body.doctor, 1);
      if (doc) body.doctor = doc._id;
    }
    // If department is passed by name instead of id
    if (typeof body.department === 'string' && body.department && !(await departmentRepo.get(body.department))) {
      const name = body.department.toLowerCase();
      const departments = await queryAll({ index: 'GSI1', pk: typePartition('DEPT') });
      const dept = departments.find((d) => String(d.name).toLowerCase().includes(name));
      if (dept) body.department = dept._id;
    }

    const data = createAppointmentSchema.parse(body);
    const appointmentDate = parseDate(data.date);

    // Prevent bookings in the past (APPT-06)
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const apptDateMidnight = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate()).getTime();
    if (apptDateMidnight < todayMidnight) {
      return res.status(400).json({ success: false, message: 'Cannot book an appointment in the past' });
    }

    const doctor = await doctorRepo.get(data.doctor);
    if (!doctor) return res.status(400).json({ success: false, message: 'Doctor not found' });

    // Validate doctor availability: only check if doctor is active (not on leave, etc.)
    if (doctor.status !== 'active') {
      return res.status(400).json({ success: false, message: `Doctor is currently ${doctor.status.replace('_', ' ')}` });
    }
    // Note: availableDays is advisory/display-only; booking system does not enforce day-of-week restrictions.
    // Real availability enforcement happens at the slot-lock level (double booking prevention).

    // Prevent patient from double-booking two doctors on the same day and time slot
    const [dayStart, dayEnd] = dayRangeIso(appointmentDate);
    const existingPatientAppts = await queryAll({
      index: 'GSI2',
      pk: patientPartition(data.patient),
      sk: { between: [`APPT#${dayStart}`, `APPT#${isoUpper(dayEnd)}`] },
    });
    const patientSlotConflict = existingPatientAppts.find(
      (a) =>
        a.status !== 'cancelled' &&
        a.status !== 'no_show' &&
        (a.timeSlot === data.timeSlot || normalizeSlot(a.timeSlot) === normalizeSlot(data.timeSlot))
    );
    if (patientSlotConflict) {
      return res.status(409).json({
        success: false,
        message: PATIENT_SLOT_TAKEN,
      });
    }

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

    // Appointment + doctor slot lock + patient slot lock + statistics are written atomically.
    await transactWrite([
      ...ops,
      acquireSlot(appointment),
      acquirePatientSlot(appointment),
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
    if (error instanceof ConflictError && (error.message === SLOT_TAKEN || error.message === PATIENT_SLOT_TAKEN)) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateAppointmentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateAppointmentStatusSchema.parse(req.body);
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Load existing appointment to verify ownership and valid state transitions
    const current = await appointmentRepo.get(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Appointment not found' });

    const currentStatus = current.status;
    const newStatus = data.status;

    // Reject transitions from terminal / finalized states (APPT-29: completed -> pending is refused)
    if (currentStatus === 'completed') {
      if (newStatus !== currentStatus) {
        return res.status(400).json({
          success: false,
          message: `Cannot transition appointment from finalized status '${currentStatus}' to '${newStatus}'`
        });
      }
    }

    // Role-specific transition rules
    if (user.role === 'patient') {
      const p = await findPatientByUser(user.id);
      if (!p || p._id !== current.patient) {
        return res.status(403).json({ success: false, message: 'Forbidden: You cannot modify another patient\'s appointment' });
      }
      // Patients can only cancel their own pending/confirmed appointments (APPT-13, APPT-14)
      if (newStatus !== 'cancelled') {
        return res.status(403).json({ success: false, message: 'Forbidden: Patients can only cancel appointments' });
      }
      if (currentStatus !== 'pending' && currentStatus !== 'confirmed') {
        return res.status(400).json({ success: false, message: `Cannot cancel an appointment that is already ${currentStatus}` });
      }
    } else if (user.role === 'doctor') {
      const d = await findDoctorByUser(user.id);
      if (!d) {
        return res.status(403).json({ success: false, message: 'Forbidden: Doctor profile required' });
      }
      const allowedForDoctor: AppointmentStatus[] = ['in_consultation', 'completed', 'cancelled', 'no_show', 'checked_in'];
      if (!allowedForDoctor.includes(newStatus)) {
        return res.status(400).json({ success: false, message: `Doctors cannot set appointment status to '${newStatus}'` });
      }
    } else if (user.role === 'receptionist') {
      const allowedForReception: AppointmentStatus[] = ['confirmed', 'checked_in', 'cancelled', 'no_show'];
      if (!allowedForReception.includes(newStatus)) {
        return res.status(400).json({ success: false, message: `Receptionists cannot set appointment status to '${newStatus}'` });
      }
    } else if (user.role === 'super_admin' || user.role === 'hospital_admin' || user.role === 'admin') {
      // Admins are allowed to manage transitions
    } else {
      // lab_staff, pharmacist, nurse cannot change appointment status (APPT-15)
      return res.status(403).json({ success: false, message: `Forbidden: Role '${user.role}' cannot change appointment status` });
    }

    let previousStatus: AppointmentStatus | undefined;

    const appointment = await appointmentRepo.update(
      req.params.id,
      (item) => {
        previousStatus = item.status;
        const patch: Partial<IAppointment> = { status: data.status };
        if (data.notes) patch.notes = data.notes;
        const wasActive = isActive(item.status);
        const willBeActive = isActive(data.status);
        if (wasActive && !willBeActive) patch.slotLock = undefined;
        if (!wasActive && willBeActive) patch.slotLock = lockFor(item).PK;
        return patch;
      },
      {
        extra: (item, nextItem) => {
          const wasActive = isActive(item.status);
          const willBeActive = isActive(nextItem.status);
          if (wasActive && !willBeActive) return [releaseSlot(item), releasePatientSlot(item)];
          if (!wasActive && willBeActive) return [acquireSlot(item), acquirePatientSlot(item)];
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
    if (error instanceof ConflictError && (error.message === SLOT_TAKEN || error.message === PATIENT_SLOT_TAKEN)) {
      return res.status(409).json({ success: false, message: 'Cannot reactivate: ' + error.message });
    }
    next(error);
  }
};

export const deleteAppointment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const appointment = await appointmentRepo.remove(req.params.id, {
      extra: (current) => [
        ...(isActive(current.status) ? [releaseSlot(current), releasePatientSlot(current)] : []),
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
    // Today: bounded BETWEEN; week/month: open-ended >= to avoid empty-string upper issues.
    const todayQuery = { index: 'GSI1' as const, pk: typePartition('APPT'), sk: { between: [dayStart, isoUpper(dayEnd)] as [string, string] } };
    const weekQuery  = { index: 'GSI1' as const, pk: typePartition('APPT'), sk: { gte: weekStart } };
    const monthQuery = { index: 'GSI1' as const, pk: typePartition('APPT'), sk: { gte: monthStart } };

    // Today's appointments are a small, date-bounded set; count statuses in memory.
    const [today, weekTotal, monthTotal] = await Promise.all([
      queryAll(todayQuery),
      queryCount(weekQuery),
      queryCount(monthQuery),
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
