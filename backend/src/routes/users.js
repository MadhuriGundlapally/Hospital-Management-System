const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const logger = require('../logger');

const router = express.Router();
router.use(authenticate);

router.get('/doctors', asyncHandler(async (req, res) => {
  const doctors = await User.find({ role: 'doctor' }).sort('name');
  res.json(doctors.map((d) => d.toSafeJSON()));
}));

router.post(
  '/',
  authorize('admin'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }),
    body('role').isIn(['doctor', 'admin']),
    body('specialty').optional().trim().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, role, specialty } = req.body;
    if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.create({ name, email, role, specialty, passwordHash: await bcrypt.hash(password, 12) });
    logger.info('staff_created', { by: req.user.id, userId: user.id, role });
    res.status(201).json(user.toSafeJSON());
  })
);

module.exports = router;
