/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobStatus, EmploymentType } from '@prisma/client';

describe('JobsService', () => {
  let service: JobsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    job: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockJob = {
    id: 'job-1',
    title: 'Senior Developer',
    description: 'Looking for a senior dev',
    department: 'Engineering',
    location: 'Remote',
    employmentType: EmploymentType.FULL_TIME,
    salaryMin: 80000,
    salaryMax: 120000,
    status: JobStatus.OPEN,
    createdById: 'user-1',
    requirements: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new job', async () => {
      const createDto = {
        title: 'Senior Developer',
        description: 'Looking for a senior dev',
        employmentType: EmploymentType.FULL_TIME,
        status: JobStatus.OPEN,
      };

      mockPrismaService.job.create.mockResolvedValue(mockJob);

      const result = await service.create('user-1', createDto);

      expect(result).toEqual(mockJob);
      expect(prisma.job.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          createdById: 'user-1',
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated jobs', async () => {
      const query = { page: 1, limit: 10 };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result).toEqual({
        data: [mockJob],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should filter by salaryMin', async () => {
      // Arrange
      const query = { page: 1, limit: 10, salaryMin: 50000 };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      // Act
      await service.findAll(query);

      // Assert
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            salaryMax: { gte: 50000 },
          }),
        }),
      );
    });

    it('should filter by salaryMax', async () => {
      // Arrange
      const query = { page: 1, limit: 10, salaryMax: 100000 };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      // Act
      await service.findAll(query);

      // Assert
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            salaryMin: { lte: 100000 },
          }),
        }),
      );
    });

    it('should filter by salary range', async () => {
      // Arrange
      const query = { page: 1, limit: 10, salaryMin: 50000, salaryMax: 150000 };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      // Act
      await service.findAll(query);

      // Assert
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            salaryMax: { gte: 50000 },
            salaryMin: { lte: 150000 },
          }),
        }),
      );
    });

    it('should filter by skills', async () => {
      // Arrange
      const query = { page: 1, limit: 10, skills: 'NestJS, TypeScript' };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      // Act
      await service.findAll(query);

      // Assert
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requirements: {
              path: ['skills'],
              array_contains: ['nestjs', 'typescript'],
            },
          }),
        }),
      );
    });

    it('should sort by salaryMin', async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 10,
        sortBy: 'salaryMin' as const,
        sortOrder: 'asc' as const,
      };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      // Act
      await service.findAll(query);

      // Assert
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { salaryMin: 'asc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a job by id', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      const result = await service.findOne('job-1');

      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException if job not found', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a job when user is owner', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.job.update.mockResolvedValue({
        ...mockJob,
        title: 'Updated Title',
      });

      const result = await service.update('job-1', 'user-1', 'RECRUITER', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw ForbiddenException if user is not owner or admin', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);

      await expect(
        service.update('job-1', 'user-2', 'RECRUITER', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should soft delete a job when user is owner', async () => {
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.job.update.mockResolvedValue({
        ...mockJob,
        deletedAt: new Date(),
      });

      await service.remove('job-1', 'user-1', 'RECRUITER');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
