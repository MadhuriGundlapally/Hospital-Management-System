const express = require('express');
const { body, param } = require('express-validator');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const logger = require('../logger');

const router = express.Router();
router.use(authenticate);

const idParam = param('id').isMongoId().withMessage('invalid id');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/me', authorize('patient'), asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ user: req.user._id }).populate('notes.doctor', 'name');
  if (!patient) return res.status(404).json({ error: 'Patient profile not found' });
  res.json(patient);
}));

router.get('/', authorize('admin', 'doctor'), asyncHandler(async (req, res) => {
  const filter = req.query.q ? { name: new RegExp(escapeRegex(String(req.query.q)), 'i') } : {};
  res.json(await Patient.find(filter).select('-notes').sort('name').limit(200));
}));

router.get('/:id', [idParam], validate, asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id).populate('notes.doctor', 'name');
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  const isStaff = ['admin', 'doctor'].includes(req.user.role);
  if (!isStaff && !patient.user.equals(req.user._id)) {
    return res.status(403).json({ error: 'You do not have permission to do that' });
  }
  res.json(patient);
}));

router.put(
  '/:id',
  authorize('admin', 'doctor'),
  [
    idParam,
    body('dateOfBirth').optional().isISO8601().toDate(),
    body('gender').optional().isIn(['female', 'male', 'other']),
    body('phone').optional().trim().isLength({ max: 30 }),
    body('address').optional().trim().isLength({ max: 300 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const update = {};
    for (const key of ['dateOfBirth', 'gender', 'phone', 'address']) if (req.body[key] !== undefined) update[key] = req.body[key];
    const patient = await Patient.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  })
);

router.post(
  '/:id/notes',
  authorize('doctor'),
  [idParam, body('text').trim().isLength({ min: 1, max: 4000 })],
  validate,
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    patient.notes.push({ doctor: req.user._id, text: req.body.text });
    await patient.save();
    logger.info('note_added', { doctorId: req.user.id, patientId: patient.id });
    res.status(201).json(patient.notes[patient.notes.length - 1]);
  })
);

router.delete('/:id', authorize('admin'), [idParam], validate, asyncHandler(async (req, res) => {
  const patient = await Patient.findByIdAndDelete(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  await Promise.all([User.findByIdAndDelete(patient.user), Appointment.deleteMany({ patient: patient._id })]);
  logger.info('patient_deleted', { by: req.user.id, patientId: patient.id });
  res.status(204).end();
}));

module.exports = router;
