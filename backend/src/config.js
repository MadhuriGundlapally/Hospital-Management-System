const required = (name, fallback) => {
  const v = process.env[name] || fallback;
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: () => required('MONGO_URI', process.env.NODE_ENV === 'production' ? undefined : 'mongodb://127.0.0.1:27017/hospital'),
  jwtSecret: () => required('JWT_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
};
