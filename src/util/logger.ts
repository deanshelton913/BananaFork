import winston from 'winston';
const { combine, timestamp, printf } = winston.format;

const rTracerFormat = printf((info) => {
  return `${info.timestamp} [${info.level}]: ${info.message}`;
});

/* istanbul ignore next */ // Not worth testing a logger.
export const logger = winston.createLogger({
  format: combine(timestamp(), rTracerFormat),
  transports: [
    new winston.transports.Console({
      level: 'verbose',
      silent: process.env.NODE_ENV === 'test',
    }),
  ],
});

/* istanbul ignore next */ // Not worth testing a PROD config.
if (process.env.NODE_ENV !== 'production') {
  logger.debug('Logging initialized at debug level');
}
