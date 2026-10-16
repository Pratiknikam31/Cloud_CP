import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { LabTest } from '../models/LabTest';
import { LabReport } from '../models/LabReport';
import { Patient } from '../models/Patient';
import {
  createLabTestSchema,
  createLabReportSchema,
  updateLabReportSchema
} from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';

// ==================== LAB TEST CATALOG ====================

export const getLabTests = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || '';

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { testCode: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;

    const tests = await LabTest.find(query).sort({ category: 1, name: 1 });
    res.status(200).json({ success: true, data: { tests } });
  } catch (err) {
    next(err);
  }
};

export const getLabTestById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const test = await LabTest.findById(req.params.id);
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
    const testCode = `LT-${Math.floor(100 + Math.random() * 900)}`;

    const test = await LabTest.create({
      testCode,
      ...validated
    });

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

export const updateLabTest = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const test = await LabTest.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
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
    const test = await LabTest.findByIdAndDelete(req.params.id);
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

export const getLabReports = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const patientId = req.query.patientId as string;
    const doctorId = req.query.doctorId as string;

    const query: any = {};
    if (status) query.status = status;
    if (patientId) query.patient = patientId;
    if (doctorId) query.doctor = doctorId;

    // Role-based scoping for patients
    if (req.user?.role === 'patient') {
      const patientProfile = await Patient.findOne({ user: req.user._id });
      if (patientProfile) {
        query.patient = patientProfile._id;
      } else {
        res.status(200).json({
          success: true,
          data: { reports: [], pagination: { total: 0, page: 1, pages: 0, limit } }
        });
        return;
      }
    }

    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      LabReport.find(query)
        .populate('patient', 'name patientId bloodGroup gender phone')
        .populate('doctor', 'name specialization')
        .populate('labTest', 'name category testCode normalRange price')
        .populate('performedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LabReport.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getLabReportById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await LabReport.findById(req.params.id)
      .populate('patient', 'name patientId bloodGroup gender phone address dob')
      .populate('doctor', 'name specialization department')
      .populate('labTest', 'name category testCode normalRange price description turnaroundHours')
      .populate('performedBy', 'name role');

    if (!report) {
      res.status(404).json({ success: false, message: 'Lab report not found' });
      return;
    }

    res.status(200).json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
};

export const createLabReport = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createLabReportSchema.parse(req.body);
    const reportId = `LAB-${Math.floor(100000 + Math.random() * 900000)}`;

    const report = await LabReport.create({
      reportId,
      ...validated,
      status: 'requested',
      results: []
    });

    const populated = await LabReport.findById(report._id)
      .populate('patient', 'name patientId')
      .populate('doctor', 'name')
      .populate('labTest', 'name testCode');

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
    const report = await LabReport.findById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, message: 'Lab report not found' });
      return;
    }

    if (validated.status) report.status = validated.status;
    if (validated.results) report.results = validated.results;
    if (validated.notes !== undefined) report.notes = validated.notes;
    if (req.user) report.performedBy = req.user._id as any;

    await report.save();

    const populated = await LabReport.findById(report._id)
      .populate('patient', 'name patientId')
      .populate('doctor', 'name')
      .populate('labTest', 'name testCode normalRange');

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
    const report = await LabReport.findByIdAndDelete(req.params.id);
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
