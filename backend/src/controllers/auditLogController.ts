import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { auditLogRepo, userRepo } from '../repositories';
import { Item, queryAll, queryPage, SortKeyCondition } from '../db/dynamo';
import { typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { isoUpper, parseDate } from '../utils/dates';
import { paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';

export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit, 25, 100);
    const cursor = parseCursor(req.query.cursor);
    const action = queryString(req.query.action);
    const entity = queryString(req.query.entity);
    const search = (queryString(req.query.search) || '').toLowerCase();
    const startDate = queryString(req.query.startDate);
    const endDate = queryString(req.query.endDate);

    // Audit logs are read from GSI1 (TYPE#AUDIT, sort key "<timestamp>#<id>"),
    // newest first. The date range becomes a sort-key condition, so only logs
    // inside the range are read.
    let sk: SortKeyCondition | undefined;
    const from = startDate ? parseDate(startDate, 'startDate').toISOString() : undefined;
    const to = endDate ? isoUpper(parseDate(endDate, 'endDate').toISOString()) : undefined;
    if (from && to) sk = { between: [from, to] };
    else if (from) sk = { gte: from };
    else if (to) sk = { lte: to };

    // action / entity / search are applied while paging through that range.
    const contains = (value: unknown) => String(value ?? '').toLowerCase().includes(search);
    const matches = (l: Item) =>
      (!action || l.action === action) &&
      (!entity || l.entity === entity) &&
      (!search || contains(l.userName) || contains(l.description) || contains(l.entityId));

    const { items, nextCursor } = await queryPage({
      index: 'GSI1',
      pk: typePartition('AUDIT'),
      sk,
      forward: false,
      limit,
      cursor,
      filter: action || entity || search ? matches : undefined,
    });

    const logs: any[] = items.map((i) => auditLogRepo.fromItem(i));
    await populate(logs, 'user', userRepo, ['name', 'email', 'role']);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: paginationMeta(limit, logs.length, nextCursor)
      }
    });
  } catch (err) {
    next(err);
  }
};

// Counts come from small counter items maintained by logAudit
// (PK STATS#AUDIT_ACTION / STATS#AUDIT_ENTITY, SK = action / entity name, attribute count),
// so no audit log has to be read. Shape matches the old $group aggregate: { _id, count }.
const readCounters = async (pk: string) =>
  (await queryAll({ pk }))
    .map((i) => ({ _id: i.SK as string, count: Number(i.count ?? 0) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

export const getAuditLogStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [actionCounts, entityCounts] = await Promise.all([
      readCounters('STATS#AUDIT_ACTION'),
      readCounters('STATS#AUDIT_ENTITY'),
    ]);
    // Every log increments exactly one action counter.
    const totalLogs = actionCounts.reduce((sum, c) => sum + c.count, 0);

    res.status(200).json({
      success: true,
      data: {
        totalLogs,
        actionCounts,
        entityCounts
      }
    });
  } catch (err) {
    next(err);
  }
};
