import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { departmentRepo } from '../repositories';
import { Item, queryPage } from '../db/dynamo';
import { changeUnique, claimUnique, releaseUnique, typePartition } from '../db/keys';
import { IDepartment } from '../types/entities';
import { createDepartmentSchema, updateDepartmentSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { ConflictError } from '../utils/errors';
import { definedFields, isTakenByOther } from '../services/identityService';

// Department names and codes are unique. DynamoDB has no unique indexes, so
// each department owns two guard items (UNIQUE#DEPTNAME#<name>, UNIQUE#DEPTCODE#<code>)
// written in the same transaction as the department. Two requests creating the
// same name/code at the same time cannot both succeed. Guards are case-insensitive.
const DEPT_EXISTS = 'Department name or code already exists';

// After a cancelled transaction: is the name or code held by another department?
const nameOrCodeTaken = async (name: string | undefined, code: string | undefined, selfId: string) =>
  (await isTakenByOther('DEPTNAME', name, selfId)) || (await isTakenByOther('DEPTCODE', code, selfId));

export const getDepartments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = queryString(req.query.search)?.toLowerCase();
    const status = queryString(req.query.status);
    const limit = parseLimit(req.query.limit, 50, 100);
    const cursor = parseCursor(req.query.cursor);

    // Departments are a small catalog on GSI1 (TYPE#DEPT) sorted by name, so the
    // original "name or code contains" search is done in memory on that partition.
    const matches = (d: Item) =>
      (!search || String(d.name).toLowerCase().includes(search) || String(d.code).toLowerCase().includes(search)) &&
      (!status || d.status === status);

    const { items, nextCursor } = await queryPage({
      index: 'GSI1',
      pk: typePartition('DEPT'),
      limit,
      cursor,
      filter: search || status ? matches : undefined,
    });
    const departments = items.map((i) => departmentRepo.fromItem(i));

    return res.json({
      success: true,
      departments,
      pagination: paginationMeta(limit, departments.length, nextCursor),
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const department = await departmentRepo.get(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    return res.json({ success: true, department });
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createDepartmentSchema.parse(req.body);
    const name = data.name.trim();
    const code = data.code.trim().toUpperCase();

    const id = randomUUID();

    // Department + both uniqueness guards atomically.
    let department: IDepartment;
    try {
      department = await departmentRepo.create(
        { _id: id, name, code, description: data.description, icon: data.icon ?? 'Stethoscope', status: 'active' },
        { extra: [claimUnique('DEPTNAME', name, id, DEPT_EXISTS), claimUnique('DEPTCODE', code, id, DEPT_EXISTS)] }
      );
    } catch (err) {
      if (err instanceof ConflictError && (err.message === DEPT_EXISTS || (await nameOrCodeTaken(name, code, id)))) {
        return res.status(400).json({ success: false, message: DEPT_EXISTS });
      }
      throw err;
    }

    await logAudit({
      user: req.user, action: 'DEPARTMENT_CREATED', entity: 'Department',
      entityId: department._id, description: `Department ${name} created`,
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Department created successfully', department });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateDepartmentSchema.parse(req.body);
    const patch: Partial<IDepartment> = definedFields(data) as Partial<IDepartment>;
    if (data.name) patch.name = data.name.trim();
    if (data.code) patch.code = data.code.trim().toUpperCase();

    let department: IDepartment | null;
    try {
      // A rename releases the old guard and claims the new one in the same
      // transaction as the (versioned) department write.
      department = await departmentRepo.update(req.params.id, () => patch, {
        extra: (current, next) => [
          ...changeUnique('DEPTNAME', current.name, next.name, current._id, DEPT_EXISTS),
          ...changeUnique('DEPTCODE', current.code, next.code, current._id, DEPT_EXISTS),
        ],
      });
    } catch (err) {
      if (err instanceof ConflictError && (err.message === DEPT_EXISTS || (await nameOrCodeTaken(patch.name, patch.code, req.params.id)))) {
        return res.status(400).json({ success: false, message: DEPT_EXISTS });
      }
      throw err;
    }
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    await logAudit({
      user: req.user, action: 'DEPARTMENT_UPDATED', entity: 'Department',
      entityId: department._id, description: `Department ${department.name} updated`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Department updated', department });
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Delete the department and free its name/code for reuse.
    const department = await departmentRepo.remove(req.params.id, {
      extra: (current) => [releaseUnique('DEPTNAME', current.name), releaseUnique('DEPTCODE', current.code)],
    });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    await logAudit({
      user: req.user, action: 'DEPARTMENT_DELETED', entity: 'Department',
      entityId: department._id, description: `Department ${department.name} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    next(error);
  }
};
