import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobStatus, EmploymentType } from '@prisma/client';
import { WorkspaceContextService } from '../common/services/workspace-context.service';

describe('JobsService (Workspace-Scoped Isolation)', () => {
  let service: JobsService;
  let prisma: PrismaService;

  const WORKSPACE_ID = 'workspace-1';

  const mockPrismaService = {
    job: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockWorkspaceContext = {
    getWorkspaceId: jest.fn().mockReturnValue(WORKSPACE_ID),
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
    workspaceId: WORKSPACE_ID,
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
        {
          provide: WorkspaceContextService,
          useValue: mockWorkspaceContext,
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
    it('should create a new job scoped to the current workspace', async () => {
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
          workspaceId: WORKSPACE_ID,
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

  describe('findAll - workspace isolation', () => {
    it('should always filter by the resolved workspaceId', async () => {
      const query = { page: 1, limit: 10 };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            deletedAt: null,
          }),
        }),
      );
    });

    it('should never leak jobs from other workspaces because the where clause always includes workspaceId', async () => {
      const query = { page: 1, limit: 10, search: 'engineer' };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      await service.findAll(query);

      const call = mockPrismaService.job.findMany.mock.calls[0][0];
      expect(call.where.workspaceId).toBe(WORKSPACE_ID);
      expect(call.where.deletedAt).toBeNull();
    });

    it('should filter by salaryMin', async () => {
      const query = { page: 1, limit: 10, salaryMin: 50000 };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            salaryMax: { gte: 50000 },
          }),
        }),
      );
    });

    it('should filter by skills', async () => {
      const query = { page: 1, limit: 10, skills: 'NestJS, TypeScript' };
      mockPrismaService.job.findMany.mockResolvedValue([mockJob]);
      mockPrismaService.job.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            requirements: {
              path: ['skills'],
              array_contains: ['nestjs', 'typescript'],
            },
          }),
        }),
      );
    });
  });

  describe('findOne - workspace isolation', () => {
    it('should look up by id AND workspaceId so cross-tenant access returns 404', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(mockJob);

      const result = await service.findOne('job-1');

      expect(result).toEqual(mockJob);
      expect(prisma.job.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1', workspaceId: WORKSPACE_ID },
        }),
      );
    });

    it('should throw NotFoundException if job not found in this workspace', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update - workspace-scoped RBAC', () => {
    it('should allow OWNER to update jobs in their workspace', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(mockJob);
      mockPrismaService.job.update.mockResolvedValue({
        ...mockJob,
        title: 'Updated Title',
      });

      const result = await service.update('job-1', 'user-1', 'OWNER', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should allow RECRUITER to update jobs in their workspace', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(mockJob);
      mockPrismaService.job.update.mockResolvedValue({
        ...mockJob,
        title: 'Updated Title',
      });

      const result = await service.update('job-1', 'user-2', 'RECRUITER', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should reject VIEWER with ForbiddenException', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(mockJob);

      await expect(
        service.update('job-1', 'user-2', 'VIEWER', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove - workspace-scoped RBAC', () => {
    it('should soft delete a job in the current workspace', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(mockJob);
      mockPrismaService.job.update.mockResolvedValue({
        ...mockJob,
        deletedAt: new Date(),
      });

      await service.remove('job-1', 'user-1', 'OWNER');

      expect(prisma.job.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should reject VIEWER with ForbiddenException', async () => {
      mockPrismaService.job.findFirst.mockResolvedValue(mockJob);

      await expect(service.remove('job-1', 'user-2', 'VIEWER')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.job.update).not.toHaveBeenCalled();
    });
  });
});
