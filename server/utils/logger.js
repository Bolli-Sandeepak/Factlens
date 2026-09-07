/**
 * Simple structured console logger for FactLens
 */

const logLevels = {
  INFO: '\x1b[36m[INFO]\x1b[0m',
  SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
  WARN: '\x1b[33m[WARN]\x1b[0m',
  ERROR: '\x1b[31m[ERROR]\x1b[0m',
  DEBUG: '\x1b[35m[DEBUG]\x1b[0m',
};

export const logger = {
  info: (msg, ...args) => console.log(`${logLevels.INFO} ${new Date().toISOString().substring(11, 19)} - ${msg}`, ...args),
  success: (msg, ...args) => console.log(`${logLevels.SUCCESS} ${new Date().toISOString().substring(11, 19)} - ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`${logLevels.WARN} ${new Date().toISOString().substring(11, 19)} - ${msg}`, ...args),
  error: (msg, ...args) => console.error(`${logLevels.ERROR} ${new Date().toISOString().substring(11, 19)} - ${msg}`, ...args),
  debug: (msg, ...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`${logLevels.DEBUG} ${new Date().toISOString().substring(11, 19)} - ${msg}`, ...args);
    }
  },
};

export default logger;
