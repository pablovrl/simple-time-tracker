import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
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
import { historySchema, startTimerSchema } from './time-entries.schemas.js';
import type { HistoryQuery, StartTimer } from './time-entries.schemas.js';
import { TimeEntriesService } from './time-entries.service.js';

@Controller()
@UseGuards(SessionGuard)
@UsePipes(new StandardSchemaValidationPipe())
export class TimeEntriesController {
  constructor(private readonly entries: TimeEntriesService) {}

  @Get('timer')
  active(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.entries.active(request.user.id);
  }

  @Post('timer/start')
  start(
    @Req() request: SessionRequest,
    @Body({ schema: startTimerSchema }) input: StartTimer,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.entries.start(request.user.id, input);
  }

  @Post('timer/stop')
  @HttpCode(200)
  stop(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.entries.stop(request.user.id);
  }

  @Get('time-entries')
  history(
    @Req() request: SessionRequest,
    @Query({ schema: historySchema }) query: HistoryQuery,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.entries.history(request.user.id, query);
  }
}
