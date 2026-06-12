/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { InterviewStatus, PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

const MOCK_WORKSPACE_ID = 'ws-test-1';

const mockWorkspaceContextService = {
  getWorkspaceId: jest.fn().mockReturnValue(MOCK_WORKSPACE_ID),
};

describe('InterviewsService', () => {
  let service: InterviewsService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewsService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        {
          provide: WorkspaceContextService,
          useValue: mockWorkspaceContextService,
        },
      ],
    }).compile();

    service = module.get<InterviewsService>(InterviewsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    it('should create an interview', async () => {
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1' } as any);
      prisma.interview.create.mockResolvedValue({
        id: 'interview-1',
        applicationId: 'app-1',
        scheduledAt: new Date(futureDate),
      } as any);

      const result = await service.create({
        applicationId: 'app-1',
        scheduledAt: futureDate,
      });

      expect(result.id).toBe('interview-1');
      expect(prisma.interview.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when application not found', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await expect(
        service.create({ applicationId: 'not-exist', scheduledAt: futureDate }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for past date', async () => {
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1' } as any);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.create({ applicationId: 'app-1', scheduledAt: pastDate }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify interviewer exists when provided', async () => {
      prisma.application.findFirst.mockResolvedValue({ id: 'app-1' } as any);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          applicationId: 'app-1',
          scheduledAt: futureDate,
          interviewerId: 'not-exist',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated interviews', async () => {
      const mockInterviews = [{ id: 'i-1' }];
      prisma.interview.findMany.mockResolvedValue(mockInterviews as any);
      prisma.interview.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockInterviews);
      expect(result.meta.total).toBe(1);
    });

    it('should apply status filter', async () => {
      prisma.interview.findMany.mockResolvedValue([]);
      prisma.interview.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 10,
        status: InterviewStatus.SCHEDULED,
      });

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SCHEDULED' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return interview by ID', async () => {
      const mockInterview = { id: 'i-1', applicationId: 'app-1' };
      prisma.interview.findFirst.mockResolvedValue(mockInterview as any);

      const result = await service.findOne('i-1');
      expect(result.id).toBe('i-1');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(service.findOne('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update interview fields', async () => {
      prisma.interview.findFirst.mockResolvedValue({ id: 'i-1' } as any);
      prisma.interview.update.mockResolvedValue({
        id: 'i-1',
        notes: 'Updated notes',
      } as any);

      const result = await service.update('i-1', { notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(
        service.update('not-exist', { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should cancel interview by updating status', async () => {
      prisma.interview.findFirst.mockResolvedValue({ id: 'i-1' } as any);
      prisma.interview.update.mockResolvedValue({
        id: 'i-1',
        status: 'CANCELLED',
      } as any);

      await service.remove('i-1');

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'i-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.interview.findFirst.mockResolvedValue(null);

      await expect(service.remove('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
