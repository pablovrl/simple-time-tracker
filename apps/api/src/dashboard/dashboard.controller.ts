import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  StandardSchemaValidationPipe,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard.js';
import type { SessionRequest } from '../auth/session.guard.js';
import { summarySchema } from './dashboard.schemas.js';
import type { SummaryQuery } from './dashboard.schemas.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(SessionGuard)
@UsePipes(new StandardSchemaValidationPipe())
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(
    @Req() request: SessionRequest,
    @Query({ schema: summarySchema }) query: SummaryQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.dashboard.summary(request.user.id, query);
  }
}
