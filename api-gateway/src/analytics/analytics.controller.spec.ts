import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TrendsQueryDto, TopJobsQueryDto } from './dto/analytics-query.dto';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    getOverview: jest.fn(),
    getPipeline: jest.fn(),
    getTrends: jest.fn(),
    getTopJobs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return overview statistics', async () => {
      const expectedResult = {
        totalJobs: 10,
        activeJobs: 5,
        totalCandidates: 100,
        totalApplications: 150,
      };

      mockAnalyticsService.getOverview.mockResolvedValue(expectedResult);

      const result = await controller.getOverview();

      expect(result).toEqual(expectedResult);
      expect(service.getOverview).toHaveBeenCalled();
    });
  });

  describe('getPipeline', () => {
    it('should return pipeline stage counts', async () => {
      const expectedResult = [
        { stage: 'NEW', count: 50 },
        { stage: 'INTERVIEWING', count: 20 },
      ];

      mockAnalyticsService.getPipeline.mockResolvedValue(expectedResult);

      const result = await controller.getPipeline();

      expect(result).toEqual(expectedResult);
      expect(service.getPipeline).toHaveBeenCalled();
    });
  });

  describe('getTrends', () => {
    it('should return application trends with default days', async () => {
      const query: TrendsQueryDto = {};
      const expectedResult = [{ date: '2023-01-01', count: 5 }];

      mockAnalyticsService.getTrends.mockResolvedValue(expectedResult);

      const result = await controller.getTrends(query);

      expect(result).toEqual(expectedResult);
      expect(service.getTrends).toHaveBeenCalledWith(30);
    });

    it('should return application trends with specific days', async () => {
      const query: TrendsQueryDto = { days: 14 };
      const expectedResult = [{ date: '2023-01-01', count: 5 }];

      mockAnalyticsService.getTrends.mockResolvedValue(expectedResult);

      const result = await controller.getTrends(query);

      expect(result).toEqual(expectedResult);
      expect(service.getTrends).toHaveBeenCalledWith(14);
    });
  });

  describe('getTopJobs', () => {
    it('should return top jobs with default limit', async () => {
      const query: TopJobsQueryDto = {};
      const expectedResult = [
        { id: '1', title: 'Job 1', department: 'Eng', applicationCount: 10 },
      ];

      mockAnalyticsService.getTopJobs.mockResolvedValue(expectedResult);

      const result = await controller.getTopJobs(query);

      expect(result).toEqual(expectedResult);
      expect(service.getTopJobs).toHaveBeenCalledWith(5);
    });

    it('should return top jobs with specific limit', async () => {
      const query: TopJobsQueryDto = { limit: 10 };
      const expectedResult = [
        { id: '1', title: 'Job 1', department: 'Eng', applicationCount: 10 },
      ];

      mockAnalyticsService.getTopJobs.mockResolvedValue(expectedResult);

      const result = await controller.getTopJobs(query);

      expect(result).toEqual(expectedResult);
      expect(service.getTopJobs).toHaveBeenCalledWith(10);
    });
  });
});
