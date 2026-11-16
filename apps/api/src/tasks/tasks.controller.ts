import {
  Body,
  Controller,
  Get,
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
import { createTaskSchema, listTasksSchema } from './tasks.schemas.js';
import type { CreateTask, ListTasks } from './tasks.schemas.js';
import { TasksService } from './tasks.service.js';

@Controller('tasks')
@UseGuards(SessionGuard)
@UsePipes(new StandardSchemaValidationPipe())
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Req() request: SessionRequest,
    @Query({ schema: listTasksSchema }) query: ListTasks,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.tasks.list(request.user.id, query);
  }

  @Post()
  create(
    @Req() request: SessionRequest,
    @Body({ schema: createTaskSchema }) input: CreateTask,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.tasks.create(request.user.id, input);
  }
}
