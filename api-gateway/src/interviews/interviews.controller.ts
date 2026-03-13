import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';
import { InterviewResponseDto } from './dto/interview-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('interviews')
@ApiBearerAuth('access-token')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @Roles(Role.RECRUITER, Role.ADMIN)
  @ApiOperation({ summary: 'Schedule a new interview' })
  @ApiResponse({
    status: 201,
    description: 'Interview scheduled successfully',
    type: InterviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Application or interviewer not found' })
  async create(@Body() createInterviewDto: CreateInterviewDto) {
    return this.interviewsService.create(createInterviewDto);
  }

  @Get()
  @Roles(Role.RECRUITER, Role.ADMIN, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Get all interviews with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Return paginated interviews' })
  async findAll(@Query() query: QueryInterviewsDto) {
    return this.interviewsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.RECRUITER, Role.ADMIN, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Get an interview by ID' })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the interview',
    type: InterviewResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Interview not found' })
  async findOne(@Param('id') id: string) {
    return this.interviewsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @ApiOperation({ summary: 'Update/reschedule an interview' })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiResponse({
    status: 200,
    description: 'Interview updated successfully',
    type: InterviewResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Interview not found' })
  async update(
    @Param('id') id: string,
    @Body() updateInterviewDto: UpdateInterviewDto,
  ) {
    return this.interviewsService.update(id, updateInterviewDto);
  }

  @Delete(':id')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel an interview' })
  @ApiParam({ name: 'id', description: 'Interview ID' })
  @ApiResponse({ status: 204, description: 'Interview cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Interview not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.interviewsService.remove(id);
  }
}
