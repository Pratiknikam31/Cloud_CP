import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { appointmentRepo, bedRepo, medicalRecordRepo, patientRepo } from '../repositories';
import { getItem, nowIso, putItem, queryAll, queryPage } from '../db/dynamo';
import { typePartition, STATS } from '../db/keys';
import { dayRangeIso } from '../utils/dates';

import { populate } from '../db/populate';
import { logAudit } from '../utils/auditLogger';
import { newRecordId } from '../utils/ids';
import { randomUUID } from 'crypto';

export interface ICareTask {
  _id: string;
  taskId: string;
  patient: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  assignedNurse?: string;
  assignedNurseName?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export const getNurseDashboard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [dayStart, dayEnd] = dayRangeIso(new Date());

    const [beds, todayAppts, tasksResult] = await Promise.all([
      queryAll({ index: 'GSI1', pk: typePartition('BED'), filter: (b) => b.status === 'occupied' }),
      queryAll({ index: 'GSI1', pk: typePartition('APPT'), sk: { between: [dayStart, dayEnd] } }),
      queryAll({ index: 'GSI1', pk: 'TYPE#NURSE_TASK' }),
    ]);

    const activeInpatients = beds.length;
    const todayAppointments = todayAppts.length;
    const pendingTasks = tasksResult.filter((t: any) => t.status !== 'completed').length;
    const completedTasks = tasksResult.filter((t: any) => t.status === 'completed').length;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          activeInpatients,
          todayAppointments,
          pendingTasks,
          completedTasks,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getCareTasks = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const items = await queryAll({ index: 'GSI1', pk: 'TYPE#NURSE_TASK' });
    const tasks = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    await populate(tasks, 'patient', patientRepo, ['name', 'patientId', 'bloodGroup', 'gender', 'dob']);

    res.status(200).json({
      success: true,
      data: { tasks },
    });
  } catch (err) {
    next(err);
  }
};

export const createCareTask = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patient: patientId, title, description, priority = 'medium', notes } = req.body;
    if (!patientId || !title) {
      res.status(400).json({ success: false, message: 'Patient ID and task title are required' });
      return;
    }

    const patient = await patientRepo.get(patientId);
    if (!patient) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    const taskId = `TASK-${Date.now().toString().slice(-6)}`;
    const id = randomUUID();
    const task: ICareTask = {
      _id: id,
      taskId,
      patient: patientId,
      title: title.trim(),
      description: description ? description.trim() : '',
      priority,
      status: 'pending',
      assignedNurse: req.user?.id,
      assignedNurseName: req.user?.name,
      notes: notes || '',
      createdAt: nowIso(),
    };

    await putItem({
      PK: `TASK#${id}`,
      SK: 'TASK',
      GSI1PK: 'TYPE#NURSE_TASK',
      GSI1SK: `${task.createdAt}#${id}`,
      entityType: 'NURSE_TASK',
      ...task,
    });

    await logAudit({
      user: req.user,
      action: 'NURSE_TASK_CREATED',
      entity: 'CareTask',
      entityId: id,
      description: `Care task '${title}' created for patient ${patient.name} by ${req.user?.name}`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Care task created successfully',
      data: { task },
    });
  } catch (err) {
    next(err);
  }
};

export const updateCareTask = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = req.params.id;
    const { status, notes } = req.body;

    const existing = await getItem(`TASK#${taskId}`, 'TASK');
    if (!existing) {
      res.status(404).json({ success: false, message: 'Care task not found' });
      return;
    }

    const updatedTask = {
      ...existing,
      status: status || existing.status,
      notes: notes !== undefined ? notes : existing.notes,
      completedAt: status === 'completed' ? nowIso() : existing.completedAt,
    };

    await putItem(updatedTask);

    await logAudit({
      user: req.user,
      action: 'NURSE_TASK_UPDATED',
      entity: 'CareTask',
      entityId: taskId,
      description: `Care task status updated to '${updatedTask.status}' by ${req.user?.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Care task updated successfully',
      data: { task: updatedTask },
    });
  } catch (err) {
    next(err);
  }
};
