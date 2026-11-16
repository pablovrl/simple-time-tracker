import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';
import { AuthUsersService } from './auth-users.service.js';
import { SessionsService } from './sessions.service.js';
import { SessionGuard } from './session.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    GoogleAuthService,
    AuthUsersService,
    SessionsService,
    SessionGuard,
  ],
  exports: [SessionsService, SessionGuard],
})
export class AuthModule {}
