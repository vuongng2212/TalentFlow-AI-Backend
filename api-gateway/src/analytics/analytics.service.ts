import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  OverviewDto,
  PipelineStageDto,
  TrendPointDto,
  TopJobDto,
} from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<OverviewDto> {
    const [
      totalJobs,
      openJobs,
      totalCandidates,
      totalApplications,
      hiredCount,
    ] = await Promise.all([
      this.prisma.job.count({ where: { deletedAt: null } }),
      this.prisma.job.count({ where: { status: 'OPEN', deletedAt: null } }),
      this.prisma.candidate.count(),
      this.prisma.application.count({ where: { deletedAt: null } }),
      this.prisma.application.count({
        where: { stage: 'HIRED', deletedAt: null },
      }),
    ]);

    const hireRate =
      totalApplications > 0
        ? Math.round((hiredCount / totalApplications) * 1000) / 10
        : 0;

    return {
      totalJobs,
      openJobs,
      totalCandidates,
      totalApplications,
      hiredCount,
      hireRate,
    };
  }

  async getPipeline(): Promise<PipelineStageDto[]> {
    const stages = await this.prisma.application.groupBy({
      by: ['stage'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    // Ensure all stages are present even if count is 0
    const allStages = [
      'APPLIED',
      'SCREENING',
      'INTERVIEW',
      'OFFER',
      'HIRED',
      'REJECTED',
    ];

    return allStages.map((stage) => {
      const found = stages.find((s) => s.stage === stage);
      return {
        stage,
        count: found ? found._count.id : 0,
      };
    });
  }

  async getTrends(days: number): Promise<TrendPointDto[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const applications = await this.prisma.application.findMany({
      where: {
        appliedAt: { gte: startDate },
        deletedAt: null,
      },
      select: { appliedAt: true },
      orderBy: { appliedAt: 'asc' },
    });

    // Group by date
    const dateMap = new Map<string, number>();

    // Initialize all dates with 0
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      dateMap.set(key, 0);
    }

    // Count applications per date
    for (const app of applications) {
      const key = app.appliedAt.toISOString().split('T')[0];
      dateMap.set(key, (dateMap.get(key) ?? 0) + 1);
    }

    return Array.from(dateMap.entries()).map(([date, applications]) => ({
      date,
      applications,
    }));
  }

  async getTopJobs(limit: number): Promise<TopJobDto[]> {
    const jobs = await this.prisma.job.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        department: true,
        status: true,
        _count: { select: { applications: true } },
      },
      orderBy: {
        applications: { _count: 'desc' },
      },
      take: limit,
    });

    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      department: job.department,
      status: job.status,
      applicationCount: job._count.applications,
    }));
  }
}
