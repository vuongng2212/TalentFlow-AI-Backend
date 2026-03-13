import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  interview: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  application: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('InterviewsService', () => {
  let service: InterviewsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
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
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      prisma.interview.create.mockResolvedValue({
        id: 'interview-1',
        applicationId: 'app-1',
        scheduledAt: new Date(futureDate),
      });

      const result = await service.create({
        applicationId: 'app-1',
        scheduledAt: futureDate,
      });

      expect(result.id).toBe('interview-1');
      expect(prisma.interview.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when application not found', async () => {
      prisma.application.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ applicationId: 'not-exist', scheduledAt: futureDate }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for past date', async () => {
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      await expect(
        service.create({ applicationId: 'app-1', scheduledAt: pastDate }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify interviewer exists when provided', async () => {
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
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
      prisma.interview.findMany.mockResolvedValue(mockInterviews);
      prisma.interview.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockInterviews);
      expect(result.meta.total).toBe(1);
    });

    it('should apply status filter', async () => {
      prisma.interview.findMany.mockResolvedValue([]);
      prisma.interview.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: 'SCHEDULED' as any });

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SCHEDULED' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return interview by ID', async () => {
      const mockInterview = { id: 'i-1', applicationId: 'app-1' };
      prisma.interview.findUnique.mockResolvedValue(mockInterview);

      const result = await service.findOne('i-1');
      expect(result.id).toBe('i-1');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.findOne('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update interview fields', async () => {
      prisma.interview.findUnique.mockResolvedValue({ id: 'i-1' });
      prisma.interview.update.mockResolvedValue({
        id: 'i-1',
        notes: 'Updated notes',
      });

      const result = await service.update('i-1', { notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(
        service.update('not-exist', { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should cancel interview by updating status', async () => {
      prisma.interview.findUnique.mockResolvedValue({ id: 'i-1' });
      prisma.interview.update.mockResolvedValue({
        id: 'i-1',
        status: 'CANCELLED',
      });

      await service.remove('i-1');

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'i-1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);

      await expect(service.remove('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
