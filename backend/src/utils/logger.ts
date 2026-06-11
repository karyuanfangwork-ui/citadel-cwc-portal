import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    config.env === 'development'
        ? winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.printf(
                (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
            )
        )
        : winston.format.json()
);

// P0-6: Replace plain File transports with DailyRotateFile to prevent unbounded log growth
const transports = [
    new winston.transports.Console(),
    new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',   // keep 30 days of error logs
    }),
    new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',   // keep 30 days of combined logs
    }),
];

// Create logger
export const logger = winston.createLogger({
    level: config.logging.level,
    levels,
    format,
    transports,
});

// Stream for Morgan
export const stream = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};