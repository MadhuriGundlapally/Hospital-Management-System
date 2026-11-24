const express = require('express');
const { body, param } = require('express-validator');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const logger = require('../logger');

const router = express.Router();
router.use(authenticate);

const populate = (q) => q.populate('patient', 'name').populate('doctor', 'name specialty');

router.post(
  '/',
  authorize('patient'),
  [
    body('doctorId').isMongoId(),
    body('scheduledAt').isISO8601().toDate().custom((d) => d > new Date()).withMessage('must be in the future'),
    body('reason').trim().isLength({ min: 3, max: 500 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const doctor = await User.findOne({ _id: req.body.doctorId, role: 'doctor' });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

    const clash = await Appointment.exists({ doctor: doctor._id, scheduledAt: req.body.scheduledAt, status: { $ne: 'cancelled' } });
    if (clash) return res.status(409).json({ error: 'That time slot is already booked for this doctor' });

    const appt = await Appointment.create({
      patient: patient._id, doctor: doctor._id, scheduledAt: req.body.scheduledAt, reason: req.body.reason,
    });
    logger.info('appointment_created', { appointmentId: appt.id, patientId: patient.id, doctorId: doctor.id });
    res.status(201).json(await populate(Appointment.findById(appt._id)));
  })
);

router.get('/', asyncHandler(async (req, res) => {
  let filter = {};
  if (req.user.role === 'doctor') filter = { doctor: req.user._id };
  if (req.user.role === 'patient') {
    const patient = await Patient.findOne({ user: req.user._id });
    filter = { patient: patient ? patient._id : null };
  }
  res.json(await populate(Appointment.find(filter).sort('scheduledAt')));
}));

router.patch(
  '/:id/status',
  [param('id').isMongoId(), body('status').isIn(['completed', 'cancelled'])],
  validate,
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const { role } = req.user;
    let allowed = role === 'admin';
    if (role === 'doctor') allowed = appt.doctor.equals(req.user._id);
    if (role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      allowed = !!patient && appt.patient.equals(patient._id) && req.body.status === 'cancelled';
    }
    if (!allowed) return res.status(403).json({ error: 'You do not have permission to do that' });
    if (appt.status !== 'scheduled') return res.status(409).json({ error: `Appointment is already ${appt.status}` });

    appt.status = req.body.status;
    await appt.save();
    logger.info('appointment_status_changed', { appointmentId: appt.id, status: appt.status, by: req.user.id });
    res.json(await populate(Appointment.findById(appt._id)));
  })
);

module.exports = router;
