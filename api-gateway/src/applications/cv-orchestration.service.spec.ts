/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { CvOrchestrationService } from './cv-orchestration.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { CvParsingStatus, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import {
  RawCvParsedEvent,
  RawCvFailedEvent,
} from '../queue/interfaces/cv-events.interface';

describe('CvOrchestrationService', () => {
  let service: CvOrchestrationService;
  let prisma: DeepMockProxy<PrismaClient>;

  const mockQueueService = {
    publishEnrichedCvParsed: jest.fn(),
    publishEnrichedCvFailed: jest.fn(),
  };

  const mockApplicationWithJobAndCandidate = {
    id: 'app-1',
    jobId: 'job-1',
    candidateId: 'cand-1',
    workspaceId: 'ws-1',
    cvParsingStatus: CvParsingStatus.PENDING,
    job: {
      id: 'job-1',
      title: 'Software Engineer',
      createdById: 'recruiter-1',
      createdBy: {
        email: 'recruiter@example.com',
      },
    },
    candidate: {
      id: 'cand-1',
      email: 'candidate@example.com',
      fullName: 'John Candidate',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvOrchestrationService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<CvOrchestrationService>(CvOrchestrationService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCvParsedEvent', () => {
    const parsedEvent: RawCvParsedEvent = {
      candidateId: 'cand-1',
      applicationId: 'app-1',
      jobId: 'job-1',
      aiScore: 85,
      parsedData: { skills: ['Node.js', 'NestJS'] },
      scoringReasoning: 'Strong backend skills',
      parsedAt: new Date().toISOString(),
    };

    it('should update application and publish EnrichedCvParsed event on happy path', async () => {
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithJobAndCandidate as any,
      );
      prisma.application.update.mockResolvedValue({} as any);

      await service.handleCvParsedEvent(parsedEvent);

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          cvParsingStatus: CvParsingStatus.COMPLETED,
          aiScore: 85,
          scoringReasoning: 'Strong backend skills',
          parsedData: { skills: ['Node.js', 'NestJS'] },
        },
      });
      expect(mockQueueService.publishEnrichedCvParsed).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-1',
          recruiterId: 'recruiter-1',
          jobTitle: 'Software Engineer',
          applicantEmail: 'candidate@example.com',
          applicantName: 'John Candidate',
          aiScore: 85,
        }),
      );
    });

    it('should skip update and publish if application is not found', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await service.handleCvParsedEvent(parsedEvent);

      expect(prisma.application.update).not.toHaveBeenCalled();
      expect(mockQueueService.publishEnrichedCvParsed).not.toHaveBeenCalled();
    });

    it('should resolve recruiter email from user table if not present on job.createdBy', async () => {
      const appWithoutRecruiterEmail = {
        ...mockApplicationWithJobAndCandidate,
        job: {
          ...mockApplicationWithJobAndCandidate.job,
          createdBy: undefined,
        },
      };
      prisma.application.findFirst.mockResolvedValue(
        appWithoutRecruiterEmail as any,
      );
      prisma.application.update.mockResolvedValue({} as any);
      prisma.user.findUnique.mockResolvedValue({
        id: 'recruiter-1',
        email: 'recruiter-from-db@example.com',
      } as any);

      await service.handleCvParsedEvent(parsedEvent);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'recruiter-1' },
      });
      expect(mockQueueService.publishEnrichedCvParsed).toHaveBeenCalled();
    });

    it('should skip publishing notification if recruiter email cannot be resolved', async () => {
      const appWithoutRecruiterEmail = {
        ...mockApplicationWithJobAndCandidate,
        job: {
          ...mockApplicationWithJobAndCandidate.job,
          createdBy: undefined,
        },
      };
      prisma.application.findFirst.mockResolvedValue(
        appWithoutRecruiterEmail as any,
      );
      prisma.application.update.mockResolvedValue({} as any);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.handleCvParsedEvent(parsedEvent);

      expect(prisma.application.update).toHaveBeenCalled();
      expect(mockQueueService.publishEnrichedCvParsed).not.toHaveBeenCalled();
    });
  });

  describe('handleCvFailedEvent', () => {
    const failedEvent: RawCvFailedEvent = {
      candidateId: 'cand-1',
      applicationId: 'app-1',
      jobId: 'job-1',
      errorCode: 'PARSE_ERROR',
      errorMessage: 'Unreadable PDF',
      retryable: false,
      failedAt: new Date().toISOString(),
    };

    it('should update application status to FAILED and publish EnrichedCvFailed event', async () => {
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithJobAndCandidate as any,
      );
      prisma.application.update.mockResolvedValue({} as any);

      await service.handleCvFailedEvent(failedEvent);

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          cvParsingStatus: CvParsingStatus.FAILED,
        },
      });
      expect(mockQueueService.publishEnrichedCvFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationId: 'app-1',
          recruiterId: 'recruiter-1',
          jobTitle: 'Software Engineer',
          applicantEmail: 'candidate@example.com',
          applicantName: 'John Candidate',
          errorMessage: 'Unreadable PDF',
        }),
      );
    });

    it('should skip update and publish if application is not found', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await service.handleCvFailedEvent(failedEvent);

      expect(prisma.application.update).not.toHaveBeenCalled();
      expect(mockQueueService.publishEnrichedCvFailed).not.toHaveBeenCalled();
    });

    it('should skip publishing notification if recruiter email cannot be resolved', async () => {
      const appWithoutRecruiterEmail = {
        ...mockApplicationWithJobAndCandidate,
        job: {
          ...mockApplicationWithJobAndCandidate.job,
          createdBy: undefined,
        },
      };
      prisma.application.findFirst.mockResolvedValue(
        appWithoutRecruiterEmail as any,
      );
      prisma.application.update.mockResolvedValue({} as any);
      prisma.user.findUnique.mockResolvedValue(null);

      await service.handleCvFailedEvent(failedEvent);

      expect(prisma.application.update).toHaveBeenCalled();
      expect(mockQueueService.publishEnrichedCvFailed).not.toHaveBeenCalled();
    });
  });
});
