import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';
import { frontendUrl } from './auth/sessions.service.js';
import { firebaseHosting } from './auth/sessions.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(), {
    instrument: ObserveInstrument,
  });
  app.enableShutdownHooks();
  // Hosting preserves /api when proxying; local API paths remain unchanged.
  if (firebaseHosting()) app.setGlobalPrefix('api');
  app.enableCors({
    origin: frontendUrl().origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
