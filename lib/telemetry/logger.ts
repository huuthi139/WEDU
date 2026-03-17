/**
 * Structured logger for WEDU.
 * Outputs JSON structured logs for auth, mutations, and system events.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

function log(level: LogLevel, scope: string, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...(data ? { data } : {}),
  };

  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(JSON.stringify(entry));
}

export const logger = {
  info: (scope: string, message: string, data?: Record<string, unknown>) => log('info', scope, message, data),
  warn: (scope: string, message: string, data?: Record<string, unknown>) => log('warn', scope, message, data),
  error: (scope: string, message: string, data?: Record<string, unknown>) => log('error', scope, message, data),
  debug: (scope: string, message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') log('debug', scope, message, data);
  },
};
