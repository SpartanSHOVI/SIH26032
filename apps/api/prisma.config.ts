import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import { resolve } from 'path';

config({ path: resolve(import.meta.dirname, '..', '..', '.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
