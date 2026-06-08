import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

@ApiTags('Jobs')
@ApiHeader({
  name: 'x-workspace-id',
  required: false,
  description: 'Active workspace ID for resource isolation',
})
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new job posting' })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires RECRUITER or ADMIN role',
  })
  async create(
    @CurrentUser() user: UserPayload,
    @Body() createJobDto: CreateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobsService.create(user.id, createJobDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all jobs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Return paginated jobs list' })
  async findAll(@Query() query: QueryJobsDto) {
    return this.jobsService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a job by ID' })
  @ApiParam({
    name: 'id',
    description: 'Job ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the job details',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async findOne(@Param('id') id: string): Promise<JobResponseDto> {
    return this.jobsService.findOne(id);
  }

  @Put(':id')
  @ApiBearerAuth('access-token')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a job posting' })
  @ApiParam({
    name: 'id',
    description: 'Job ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Job updated successfully',
    type: JobResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the owner or admin',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() updateJobDto: UpdateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobsService.update(id, user.id, user.role, updateJobDto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job (soft delete)' })
  @ApiParam({
    name: 'id',
    description: 'Job ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 204, description: 'Job deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the owner or admin',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ): Promise<void> {
    return this.jobsService.remove(id, user.id, user.role);
  }
}
