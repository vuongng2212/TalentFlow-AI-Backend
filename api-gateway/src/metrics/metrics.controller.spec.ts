/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Response } from 'express';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: MetricsService;

  const mockRegistry = {
    metrics: jest.fn().mockResolvedValue('# HELP test metric\ntest_metric 1'),
  };

  const mockMetricsService = {
    getRegistry: jest.fn().mockReturnValue(mockRegistry),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get<MetricsService>(MetricsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMetrics', () => {
    it('should return prometheus metrics', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.getMetrics(mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(
        '# HELP test metric\ntest_metric 1',
      );
      expect(metricsService.getRegistry).toHaveBeenCalled();
    });

    it('should call registry.metrics()', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.getMetrics(mockResponse);

      expect(mockRegistry.metrics).toHaveBeenCalled();
    });
  });
});
