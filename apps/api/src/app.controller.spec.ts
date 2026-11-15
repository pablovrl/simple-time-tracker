import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthService } from './health.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: HealthService,
          useValue: {
            check: vi.fn().mockResolvedValue({
              status: 'ok',
              database: { status: 'up' },
            }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return the database health status', async () => {
      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        database: { status: 'up' },
      });
    });
  });
});
