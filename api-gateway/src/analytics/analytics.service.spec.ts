import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  job: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  candidate: {
    count: jest.fn(),
  },
  application: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview stats', async () => {
      prisma.job.count
        .mockResolvedValueOnce(10) // totalJobs
        .mockResolvedValueOnce(5); // openJobs
      prisma.candidate.count.mockResolvedValue(50);
      prisma.application.count
        .mockResolvedValueOnce(80) // totalApplications
        .mockResolvedValueOnce(8); // hiredCount

      const result = await service.getOverview();

      expect(result).toEqual({
        totalJobs: 10,
        openJobs: 5,
        totalCandidates: 50,
        totalApplications: 80,
        hiredCount: 8,
        hireRate: 10,
      });
    });

    it('should return 0 hire rate when no applications', async () => {
      prisma.job.count.mockResolvedValue(0);
      prisma.candidate.count.mockResolvedValue(0);
      prisma.application.count.mockResolvedValue(0);

      const result = await service.getOverview();
      expect(result.hireRate).toBe(0);
    });
  });

  describe('getPipeline', () => {
    it('should return all stages with counts', async () => {
      prisma.application.groupBy.mockResolvedValue([
        { stage: 'APPLIED', _count: { id: 20 } },
        { stage: 'SCREENING', _count: { id: 10 } },
        { stage: 'HIRED', _count: { id: 3 } },
      ]);

      const result = await service.getPipeline();

      expect(result).toHaveLength(6); // All 6 stages
      expect(result.find((s) => s.stage === 'APPLIED')?.count).toBe(20);
      expect(result.find((s) => s.stage === 'INTERVIEW')?.count).toBe(0); // Missing = 0
    });
  });

  describe('getTrends', () => {
    it('should return trend points for date range', async () => {
      prisma.application.findMany.mockResolvedValue([]);

      const result = await service.getTrends(7);

      // Should return 8 data points (day 0 through day 7)
      expect(result.length).toBeGreaterThanOrEqual(7);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('applications');
    });
  });

  describe('getTopJobs', () => {
    it('should return top jobs sorted by application count', async () => {
      const mockJobs = [
        { id: '1', title: 'Engineer', department: 'Eng', status: 'OPEN', _count: { applications: 10 } },
        { id: '2', title: 'Designer', department: 'Design', status: 'OPEN', _count: { applications: 5 } },
      ];
      prisma.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.getTopJobs(5);

      expect(result).toHaveLength(2);
      expect(result[0].applicationCount).toBe(10);
      expect(result[1].title).toBe('Designer');
    });
  });
});
