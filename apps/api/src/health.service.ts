import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

@Injectable()
export class HealthService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async check(): Promise<{ status: 'ok'; database: { status: 'up' } }> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { status: 'ok', database: { status: 'up' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: { status: 'down' },
      });
    }
  }
}
