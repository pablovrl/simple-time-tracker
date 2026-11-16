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
import { createProjectSchema, listProjectsSchema } from './projects.schemas.js';
import type { CreateProject, ListProjects } from './projects.schemas.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(SessionGuard)
@UsePipes(new StandardSchemaValidationPipe())
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(
    @Req() request: SessionRequest,
    @Query({ schema: listProjectsSchema }) query: ListProjects,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.projects.list(request.user.id, query);
  }

  @Post()
  create(
    @Req() request: SessionRequest,
    @Body({ schema: createProjectSchema }) input: CreateProject,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.projects.create(request.user.id, input);
  }
}
