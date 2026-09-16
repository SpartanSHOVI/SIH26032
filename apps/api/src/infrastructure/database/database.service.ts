import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../../config/env';
export type Tx = Prisma.TransactionClient;

/**
 * Validates SQL query text and parameters to prevent injection attacks.
 */
function assertSqlSafety(sql: string, params: unknown[]): void {
  // Reject multiple queries chained with semicolons in user-provided SQL fragments
  if (/;\s*(drop|alter|truncate|delete\s+from|insert\s+into|update)\b/i.test(sql)) {
    throw new Error('Dangerous SQL statement chaining detected');
  }

  // Check parameters for classic SQL injection patterns in string inputs
  const flatParams = params.flat(Infinity);
  for (const param of flatParams) {
    if (typeof param === 'string') {
      const trimmed = param.trim();
      if (
        /(\bUNION\b\s+\bSELECT\b|'\s*OR\s*['"1]|;\s*DROP\s+TABLE|--\s*$)/i.test(trimmed)
      ) {
        throw new Error('Potential SQL injection pattern detected in query parameters');
      }
    }
  }
}

export async function rows<T = Record<string, any>>(
  db: Tx | PrismaClient,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  assertSqlSafety(sql, params);
  return db.$queryRawUnsafe<T[]>(sql, ...params);
}

export async function first<T = Record<string, any>>(
  db: Tx | PrismaClient,
  sql: string,
  ...params: unknown[]
): Promise<T | undefined> {
  return (await rows<T>(db, sql, ...params))[0];
}

export function serializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
 constructor(){super({adapter:new PrismaPg({connectionString:env.DATABASE_URL})});}
 async onModuleDestroy(){await this.$disconnect();}
}
@Global() @Module({providers:[DatabaseService],exports:[DatabaseService]}) export class DatabaseModule {}
