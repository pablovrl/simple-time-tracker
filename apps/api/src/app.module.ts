import { Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthService } from './health.service.js';
import { AuthModule } from './auth/auth.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { TimeEntriesModule } from './time-entries/time-entries.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    AuthModule,
    TasksModule,
    TimeEntriesModule,
    DashboardModule,
    DrizzleModule.forRootAsync({
      useFactory: () => {
        if (existsSync('.env')) {
          loadEnvFile('.env');
        }
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
          throw new Error('DATABASE_URL is required');
        }
        return {
          drizzle,
          connection: {
            connectionString,
            connectionTimeoutMillis: 2000,
            query_timeout: 2000,
            statement_timeout: 2000,
          },
        };
      },
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, HealthService],
})
export class AppModule {}
