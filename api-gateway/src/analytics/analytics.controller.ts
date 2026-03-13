import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TrendsQueryDto, TopJobsQueryDto } from './dto/analytics-query.dto';
import {
  OverviewDto,
  PipelineStageDto,
  TrendPointDto,
  TopJobDto,
} from './dto/analytics-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
@Roles(Role.RECRUITER, Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get overall recruitment statistics' })
  @ApiResponse({
    status: 200,
    description: 'Overview statistics',
    type: OverviewDto,
  })
  async getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Get candidate counts per pipeline stage' })
  @ApiResponse({
    status: 200,
    description: 'Pipeline stage counts',
    type: [PipelineStageDto],
  })
  async getPipeline() {
    return this.analyticsService.getPipeline();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get application trends over time' })
  @ApiResponse({
    status: 200,
    description: 'Application trend data points',
    type: [TrendPointDto],
  })
  async getTrends(@Query() query: TrendsQueryDto) {
    return this.analyticsService.getTrends(query.days ?? 30);
  }

  @Get('top-jobs')
  @ApiOperation({ summary: 'Get jobs with most applications' })
  @ApiResponse({
    status: 200,
    description: 'Top jobs by application count',
    type: [TopJobDto],
  })
  async getTopJobs(@Query() query: TopJobsQueryDto) {
    return this.analyticsService.getTopJobs(query.limit ?? 5);
  }
}
