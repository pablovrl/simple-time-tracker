import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [GoogleAuthService],
})
export class AuthModule {}
