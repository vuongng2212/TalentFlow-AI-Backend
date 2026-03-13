import {
  Controller,
  Get,
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
import { CandidatesService } from './candidates.service';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { UpdateCandidateDto } from './dto/update-candidate.dto';
import { CandidateResponseDto } from './dto/candidate-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('candidates')
@ApiBearerAuth('access-token')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @Roles(Role.RECRUITER, Role.ADMIN, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Get all candidates with pagination and search' })
  @ApiResponse({ status: 200, description: 'Return paginated candidates' })
  async findAll(@Query() query: QueryCandidatesDto) {
    return this.candidatesService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.RECRUITER, Role.ADMIN, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Get a candidate by ID with their applications' })
  @ApiParam({ name: 'id', description: 'Candidate ID' })
  @ApiResponse({
    status: 200,
    description: 'Return the candidate with applications',
    type: CandidateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  async findOne(@Param('id') id: string) {
    return this.candidatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @ApiOperation({ summary: 'Update a candidate' })
  @ApiParam({ name: 'id', description: 'Candidate ID' })
  @ApiResponse({
    status: 200,
    description: 'Candidate updated successfully',
    type: CandidateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCandidateDto: UpdateCandidateDto,
  ) {
    return this.candidatesService.update(id, updateCandidateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a candidate (admin only)' })
  @ApiParam({ name: 'id', description: 'Candidate ID' })
  @ApiResponse({ status: 204, description: 'Candidate deleted successfully' })
  @ApiResponse({ status: 404, description: 'Candidate not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.candidatesService.remove(id);
  }
}
