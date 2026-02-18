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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadCvDto } from './dto/upload-cv.dto';
import { UploadCvResponseDto } from './dto/upload-cv-response.dto';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

@ApiTags('applications')
@ApiBearerAuth('access-token')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @ApiOperation({ summary: 'Apply to a job' })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 409, description: 'Already applied to this job' })
  async create(
    @CurrentUser() user: UserPayload,
    @Body() createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.create(
      user.id,
      createApplicationDto,
    ) as Promise<ApplicationResponseDto>;
  }

  @Post('upload')
  @ApiOperation({ summary: 'Apply to a job with CV upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'jobId'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        jobId: {
          type: 'string',
          format: 'uuid',
        },
        coverLetter: {
          type: 'string',
          maxLength: 2000,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Application with CV submitted successfully',
    type: UploadCvResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or file too large',
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @ApiResponse({ status: 409, description: 'Already applied to this job' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadCv(
    @CurrentUser() user: UserPayload,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
    @Body() dto: UploadCvDto,
  ): Promise<UploadCvResponseDto> {
    return this.applicationsService.createWithCv(user.id, file, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get applications (filtered by role)' })
  @ApiResponse({ status: 200, description: 'Return paginated applications' })
  async findAll(
    @CurrentUser() user: UserPayload,
    @Query() query: QueryApplicationsDto,
  ) {
    return this.applicationsService.findAll(user.id, user.role, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an application by ID' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the application',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.findOne(id, user.id, user.role);
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Update an application (stage/status/notes by recruiter, cover letter by candidate)',
  })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({
    status: 200,
    description: 'Application updated successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Body() updateApplicationDto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationsService.update(
      id,
      user.id,
      user.role,
      updateApplicationDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Withdraw an application (candidates only)' })
  @ApiParam({ name: 'id', description: 'Application ID' })
  @ApiResponse({
    status: 204,
    description: 'Application withdrawn successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ): Promise<void> {
    return this.applicationsService.remove(id, user.id, user.role);
  }
}
