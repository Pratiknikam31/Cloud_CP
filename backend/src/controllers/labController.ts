import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { doctorRepo, labReportRepo, labTestRepo, patientRepo, userRepo } from '../repositories';
import { findPatientByUser } from '../repositories/profiles';
import { Item, nowIso, queryAll, queryPage, QueryOptions, transactWrite } from '../db/dynamo';
import { changeUnique, claimUnique, doctorPartition, patientPartition, releaseUnique, typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { ILabReport, ILabTest } from '../types/entities';
import {
  createLabTestSchema,
  createLabReportSchema,
  updateLabReportSchema
} from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newLabReportId, newLabTestCode } from '../utils/ids';
import { BadRequestError, ConflictError } from '../utils/errors';

// Test codes are unique: a guard item UNIQUE#LABTEST#<code> is written in the
// same transaction as the lab test (DynamoDB has no unique indexes).
const CODE_TAKEN = 'A lab test with this test code already exists';

// ==================== LAB TEST CATALOG ====================

export const getLabTests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = (queryString(req.query.search) ?? '').toLowerCase();
    const category = queryString(req.query.category);
    const has = (v: unknown) => String(v ?? '').toLowerCase().includes(search);

    // The lab test catalog is small: load it from GSI1 (already sorted by
    // category, name) and filter in memory. The original regex search becomes a
    // case-insensitive substring match.
    const items = await queryAll({
      index: 'GSI1',
      pk: typePartition('LABTEST'),
      filter: (t) => (!search || has(t.name) || has(t.testCode) || has(t.category)) && (!category || t.category === category),
    });
    const tests = items.map((i) => labTestRepo.fromItem(i));
    res.status(200).json({ success: true, data: { tests } });
  } catch (err) {
    next(err);
  }
};

export const getLabTestById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const test = await labTestRepo.get(req.params.id);
    if (!test) {
      res.status(404).json({ success: false, message: 'Lab test not found' });
      return;
    }
    res.status(200).json({ success: true, data: { test } });
  } catch (err) {
    next(err);
  }
};

export const createLabTest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createLabTestSchema.parse(req.body);

    // The counter never repeats, but a code could already be taken by a test
    // whose code was edited by hand; then we simply take the next number.
    let test: ILabTest | undefined;
    for (let attempt = 1; !test; attempt++) {
      const testCode = await newLabTestCode();
      const { entity, ops } = labTestRepo.prepareCreate({ testCode, ...validated });
      try {
        await transactWrite([...ops, claimUnique('LABTEST', testCode, entity._id, CODE_TAKEN)]);
        test = entity;
      } catch (err) {
        if (!(err instanceof ConflictError && err.message === CODE_TAKEN) || attempt >= 5) throw err;
      }
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'CREATE',
        'LabTest',
        test._id.toString(),
        `Created lab test ${test.name} (${test.testCode})`
      );
    }

    res.status(201).json({
      success: true,
      message: 'Lab test created successfully',
      data: { test }
    });
  } catch (err) {
    next(err);
  }
};

// The original applied req.body directly (findByIdAndUpdate). Mongoose silently
// ignored fields that are not in the schema and cast values to the schema types;
// we do the same here, so _id/createdAt/updatedAt can never be overwritten.
const STRING_FIELDS = ['testCode', 'name', 'category', 'description', 'normalRange'] as const;
const NUMBER_FIELDS = ['price', 'turnaroundHours'] as const;

const labTestChanges = (body: any): Partial<ILabTest> => {
  const patch: Record<string, any> = {};
  if (!body || typeof body !== 'object') return patch;
  for (const field of STRING_FIELDS) {
    if (body[field] === undefined) continue;
    // Objects/arrays could not be cast to a string by Mongoose either.
    if (body[field] !== null && typeof body[field] === 'object') throw new BadRequestError(`Invalid ${field}`);
    const raw = body[field] === null ? '' : String(body[field]);
    // The original schema only trimmed testCode and name.
    const value = field === 'testCode' || field === 'name' ? raw.trim() : raw;
    if (value === '') throw new BadRequestError(`${field} is required`);
    patch[field] = field === 'testCode' ? value.toUpperCase() : value;
  }
  for (const field of NUMBER_FIELDS) {
    if (body[field] === undefined) continue;
    const value = Number(body[field]);
    if (body[field] === null || body[field] === '' || typeof body[field] === 'object' || !Number.isFinite(value)) throw new BadRequestError(`Invalid ${field}`);
    patch[field] = value;
  }
  return patch;
};

export const updateLabTest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const changes = labTestChanges(req.body);
    const test = await labTestRepo.update(req.params.id, () => changes, {
      // A changed test code moves its uniqueness guard in the same transaction.
      extra: (current, next) => changeUnique('LABTEST', current.testCode, next.testCode, current._id, CODE_TAKEN),
    });
    if (!test) {
      res.status(404).json({ success: false, message: 'Lab test not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'UPDATE',
        'LabTest',
        test._id.toString(),
        `Updated lab test ${test.name}`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Lab test updated successfully',
      data: { test }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteLabTest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const test = await labTestRepo.remove(req.params.id, {
      extra: (current) => [releaseUnique('LABTEST', current.testCode)],
    });
    if (!test) {
      res.status(404).json({ success: false, message: 'Lab test not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DELETE',
        'LabTest',
        test._id.toString(),
        `Deleted lab test ${test.name}`
      );
    }

    res.status(200).json({ success: true, message: 'Lab test deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ==================== LAB REPORTS ====================

const publicReports = (items: Item[]) => items.map((i) => labReportRepo.fromItem(i)) as any[];

export const getLabReports = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const status = queryString(req.query.status);
    let patientId = queryString(req.query.patientId);
    const doctorId = queryString(req.query.doctorId);

    // Role-based scoping for patients
    if (req.user?.role === 'patient') {
      const patientProfile = await findPatientByUser(req.user._id);
      if (patientProfile) {
        patientId = patientProfile._id;
      } else {
        res.status(200).json({
          success: true,
          data: { reports: [], pagination: paginationMeta(limit, 0) }
        });
        return;
      }
    }

    // Choose the most selective index: by patient (GSI2), by doctor (GSI3), or
    // hospital-wide (GSI1). All are sorted by createdAt; newest first.
    let query: QueryOptions;
    if (patientId) {
      query = { index: 'GSI2', pk: patientPartition(patientId), sk: { beginsWith: 'LAB#' } };
    } else if (doctorId) {
      query = { index: 'GSI3', pk: doctorPartition(doctorId), sk: { beginsWith: 'LAB#' } };
    } else {
      query = { index: 'GSI1', pk: typePartition('LAB') };
    }

    const { items, nextCursor } = await queryPage({
      ...query,
      forward: false,
      limit,
      cursor,
      filter: (r) => (!status || r.status === status) && (!doctorId || r.doctor === doctorId),
    });

    const reports = publicReports(items);
    await Promise.all([
      populate(reports, 'patient', patientRepo, ['name', 'patientId', 'bloodGroup', 'gender', 'phone']),
      populate(reports, 'doctor', doctorRepo, ['name', 'specialization']),
      populate(reports, 'labTest', labTestRepo, ['name', 'category', 'testCode', 'normalRange', 'price']),
      populate(reports, 'performedBy', userRepo, ['name', 'role']),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: paginationMeta(limit, reports.length, nextCursor)
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getLabReportById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const found = await labReportRepo.get(req.params.id);
    if (!found) {
      res.status(404).json({ success: false, message: 'Lab report not found' });
      return;
    }

    const report: any = { ...found };
    await Promise.all([
      populate([report], 'patient', patientRepo, ['name', 'patientId', 'bloodGroup', 'gender', 'phone', 'address', 'dob']),
      populate([report], 'doctor', doctorRepo, ['name', 'specialization', 'department']),
      populate([report], 'labTest', labTestRepo, ['name', 'category', 'testCode', 'normalRange', 'price', 'description', 'turnaroundHours']),
      populate([report], 'performedBy', userRepo, ['name', 'role']),
    ]);

    res.status(200).json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
};

export const createLabReport = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createLabReportSchema.parse(req.body);
    const reportId = await newLabReportId();

    const report = await labReportRepo.create({
      reportId,
      patient: validated.patient,
      doctor: validated.doctor,
      labTest: validated.labTest,
      notes: validated.notes ?? '',
      requestedDate: nowIso(),
      status: 'requested',
      results: [],
      reportFile: '',
    });

    const populated: any = { ...report };
    await Promise.all([
      populate([populated], 'patient', patientRepo, ['name', 'patientId']),
      populate([populated], 'doctor', doctorRepo, ['name']),
      populate([populated], 'labTest', labTestRepo, ['name', 'testCode']),
    ]);

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'CREATE',
        'LabReport',
        report._id.toString(),
        `Requested lab test ${report.reportId}`
      );
    }

    res.status(201).json({
      success: true,
      message: 'Lab test requested successfully',
      data: { report: populated }
    });
  } catch (err) {
    next(err);
  }
};

export const updateLabReport = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = updateLabReportSchema.parse(req.body);

    // Version-checked update: a concurrent change to the same report returns 409.
    const report = await labReportRepo.update(req.params.id, () => {
      const patch: Partial<ILabReport> = {};
      if (validated.status) patch.status = validated.status;
      if (validated.results) patch.results = validated.results;
      if (validated.notes !== undefined) patch.notes = validated.notes;
      if (req.user) patch.performedBy = req.user._id;
      return patch;
    });
    if (!report) {
      res.status(404).json({ success: false, message: 'Lab report not found' });
      return;
    }

    const populated: any = { ...report };
    await Promise.all([
      populate([populated], 'patient', patientRepo, ['name', 'patientId']),
      populate([populated], 'doctor', doctorRepo, ['name']),
      populate([populated], 'labTest', labTestRepo, ['name', 'testCode', 'normalRange']),
    ]);

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'UPDATE',
        'LabReport',
        report._id.toString(),
        `Updated lab report ${report.reportId} status to ${report.status}`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Lab report updated successfully',
      data: { report: populated }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteLabReport = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await labReportRepo.remove(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, message: 'Lab report not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DELETE',
        'LabReport',
        report._id.toString(),
        `Deleted lab report ${report.reportId}`
      );
    }

    res.status(200).json({ success: true, message: 'Lab report deleted successfully' });
  } catch (err) {
    next(err);
  }
};
