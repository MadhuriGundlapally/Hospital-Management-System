const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const logger = require('./logger');

async function start() {
  config.jwtSecret(); // fail fast if JWT_SECRET is missing in production
  await mongoose.connect(config.mongoUri());
  logger.info('mongo_connected');
  app.listen(config.port, () => logger.info('server_started', { port: config.port }));
}

start().catch((err) => {
  logger.error('startup_failed', { message: err.message });
  process.exit(1);
});
