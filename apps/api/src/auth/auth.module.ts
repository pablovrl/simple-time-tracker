import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';
import { AuthUsersService } from './auth-users.service.js';

@Module({
  controllers: [AuthController],
  providers: [GoogleAuthService, AuthUsersService],
})
export class AuthModule {}
