const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  res.status(400).json({
    error: 'Validation failed',
    details: result.array().map((e) => `${e.path}: ${e.msg}`),
  });
};
