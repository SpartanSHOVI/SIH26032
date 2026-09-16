import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load .env from workspace root.
config({ path: resolve(__dirname, '..', '..', '..', '..', '.env') });

export const env = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    APP_ORIGIN: z.string().url().default('http://localhost:3000'),
    DEMO_AUTH: z.enum(['true', 'false']).default('false'),
    DEMO_MODE: z.enum(['true', 'false']).default('false').optional(),
    GATEWAY_SECRET: z.string().min(32).optional(),
    GOOGLE_TRANSLATE_API_KEY: z.string().min(10).optional(),
    BHASHINI_API_KEY: z.string().optional(),
    BHASHINI_USER_ID: z.string().optional(),
    BHASHINI_INFERENCE_URL: z.string().url().optional(),
}).parse(process.env);

export const isDemoAuthEnabled = (): boolean => {
    return env.DEMO_AUTH === 'true' || process.env.DEMO_MODE === 'true';
};

if (env.NODE_ENV === 'production' && isDemoAuthEnabled()) {
    throw new Error('FATAL: Demo authentication / DEMO_MODE is strictly forbidden in production environments');
}

