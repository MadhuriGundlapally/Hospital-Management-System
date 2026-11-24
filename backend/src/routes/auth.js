const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const User = require('../models/User');
const Patient = require('../models/Patient');
const validate = require('../middleware/validate');
const { signToken, authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const logger = require('../logger');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8, max: 128 }).withMessage('must be 8-128 characters'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    // Public registration always creates a patient. Doctors/admins are created by an admin.
    const { name, email, password } = req.body;
    if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'patient' });
    await Patient.create({ user: user._id, name });
    logger.info('user_registered', { userId: user.id, role: user.role });
    res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) {
      logger.warn('login_failed', { email: req.body.email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    logger.info('login_success', { userId: user.id });
    res.json({ token: signToken(user), user: user.toSafeJSON() });
  })
);

router.get('/me', authenticate, (req, res) => res.json({ user: req.user.toSafeJSON() }));

module.exports = router;
