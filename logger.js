import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// LOG_LEVEL overrides the default so `debug` can be turned on in production
// (e.g. to trace SAIH requests) without a code change or redeploy.
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

export const logger = pino({
    level,
    // Ensures `{ err }` fields serialize with message/stack/type instead of
    // just the Error's own enumerable properties.
    serializers: { err: pino.stdSerializers.err },
    // Structured JSON in production (greppable, aggregator-friendly);
    // colorized single-line output locally.
    ...(isProduction ? {} : {
        transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
    }),
});
