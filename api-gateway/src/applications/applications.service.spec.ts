/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  JobStatus,
  EmploymentType,
  Role,
} from '@prisma/client';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    application: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    candidate: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-1',
    email: 'applicant@test.com',
    password: 'hashed',
    fullName: 'Test Applicant',
    role: Role.RECRUITER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockRecruiterUser = {
    id: 'recruiter-1',
    email: 'recruiter@test.com',
    password: 'hashed',
    fullName: 'Test Recruiter',
    role: Role.RECRUITER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCandidate = {
    id: 'candidate-1',
    email: 'applicant@test.com',
    fullName: 'Test Applicant',
    phone: null,
    linkedinUrl: null,
    resumeUrl: null,
    resumeText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdById: 'recruiter-1',
    requirements: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockApplication = {
    id: 'app-1',
    jobId: 'job-1',
    candidateId: 'candidate-1',
    stage: ApplicationStage.APPLIED,
    status: ApplicationStatus.SUBMITTED,
    cvFileKey: null,
    cvFileUrl: null,
    coverLetter: 'I am interested',
    notes: null,
    appliedAt: new Date(),
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an application successfully', async () => {
      // Arrange
      const createDto = { jobId: 'job-1', coverLetter: 'I am interested' };
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockPrismaService.application.findFirst.mockResolvedValue(null);
      mockPrismaService.application.create.mockResolvedValue({
        ...mockApplication,
        job: {
          id: 'job-1',
          title: 'Senior Developer',
          department: 'Engineering',
        },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      });

      // Act
      const result = await service.create('user-1', createDto);

      // Assert
      expect(result.jobId).toBe('job-1');
      expect(result.candidateId).toBe('candidate-1');
      expect(prisma.application.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when job not found', async () => {
      // Arrange
      const createDto = { jobId: 'non-existent-job' };
      mockPrismaService.job.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create('user-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when job is soft deleted', async () => {
      // Arrange
      const createDto = { jobId: 'deleted-job' };
      mockPrismaService.job.findUnique.mockResolvedValue({
        ...mockJob,
        deletedAt: new Date(),
      });

      // Act & Assert
      await expect(service.create('user-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when job is not open', async () => {
      // Arrange
      const createDto = { jobId: 'job-1' };
      mockPrismaService.job.findUnique.mockResolvedValue({
        ...mockJob,
        status: JobStatus.CLOSED,
      });

      // Act & Assert
      await expect(service.create('user-1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      // Arrange
      const createDto = { jobId: 'job-1' };
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create('non-existent-user', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create candidate if not exists', async () => {
      // Arrange
      const createDto = { jobId: 'job-1' };
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);
      mockPrismaService.candidate.create.mockResolvedValue(mockCandidate);
      mockPrismaService.application.findFirst.mockResolvedValue(null);
      mockPrismaService.application.create.mockResolvedValue({
        ...mockApplication,
        job: {
          id: 'job-1',
          title: 'Senior Developer',
          department: 'Engineering',
        },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      });

      // Act
      await service.create('user-1', createDto);

      // Assert
      expect(prisma.candidate.create).toHaveBeenCalledWith({
        data: {
          email: mockUser.email,
          fullName: mockUser.fullName,
        },
      });
    });

    it('should throw ConflictException when already applied', async () => {
      // Arrange
      const createDto = { jobId: 'job-1' };
      mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockPrismaService.application.findFirst.mockResolvedValue(
        mockApplication,
      );

      // Act & Assert
      await expect(service.create('user-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated applications for recruiter', async () => {
      // Arrange
      const query = { page: 1, limit: 10 };
      mockPrismaService.application.findMany.mockResolvedValue([
        mockApplication,
      ]);
      mockPrismaService.application.count.mockResolvedValue(1);

      // Act
      const result = await service.findAll('recruiter-1', 'RECRUITER', query);

      // Assert
      expect(result).toEqual({
        data: [mockApplication],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should filter by job owner for recruiter role', async () => {
      // Arrange
      const query = { page: 1, limit: 10 };
      mockPrismaService.application.findMany.mockResolvedValue([]);
      mockPrismaService.application.count.mockResolvedValue(0);

      // Act
      await service.findAll('recruiter-1', 'RECRUITER', query);

      // Assert
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            job: { createdById: 'recruiter-1' },
          }),
        }),
      );
    });

    it('should filter by candidate for non-admin users', async () => {
      // Arrange
      const query = { page: 1, limit: 10 };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockPrismaService.application.findMany.mockResolvedValue([]);
      mockPrismaService.application.count.mockResolvedValue(0);

      // Act
      await service.findAll('user-1', 'INTERVIEWER', query);

      // Assert
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            candidateId: 'candidate-1',
          }),
        }),
      );
    });

    it('should filter by stage when provided', async () => {
      // Arrange
      const query = { page: 1, limit: 10, stage: ApplicationStage.INTERVIEW };
      mockPrismaService.application.findMany.mockResolvedValue([]);
      mockPrismaService.application.count.mockResolvedValue(0);

      // Act
      await service.findAll('recruiter-1', 'ADMIN', query);

      // Assert
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stage: ApplicationStage.INTERVIEW,
          }),
        }),
      );
    });

    it('should filter by status when provided', async () => {
      // Arrange
      const query = { page: 1, limit: 10, status: ApplicationStatus.REVIEWING };
      mockPrismaService.application.findMany.mockResolvedValue([]);
      mockPrismaService.application.count.mockResolvedValue(0);

      // Act
      await service.findAll('recruiter-1', 'ADMIN', query);

      // Assert
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ApplicationStatus.REVIEWING,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    const mockApplicationWithRelations = {
      ...mockApplication,
      job: {
        ...mockJob,
        createdBy: {
          id: 'recruiter-1',
          email: 'recruiter@test.com',
          fullName: 'Test Recruiter',
        },
      },
      candidate: {
        id: 'candidate-1',
        email: 'applicant@test.com',
        fullName: 'Test Applicant',
      },
    };

    it('should return application when found by admin', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockRecruiterUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findOne('app-1', 'admin-1', 'ADMIN');

      // Assert
      expect(result).toEqual(mockApplicationWithRelations);
    });

    it('should return application when user is the applicant', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(mockCandidate);

      // Act
      const result = await service.findOne('app-1', 'user-1', 'RECRUITER');

      // Assert
      expect(result).toEqual(mockApplicationWithRelations);
    });

    it('should return application when user is the job recruiter', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockRecruiterUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findOne('app-1', 'recruiter-1', 'RECRUITER');

      // Assert
      expect(result).toEqual(mockApplicationWithRelations);
    });

    it('should throw NotFoundException when application not found', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findOne('non-existent', 'user-1', 'RECRUITER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when application is soft deleted', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue({
        ...mockApplicationWithRelations,
        deletedAt: new Date(),
      });

      // Act & Assert
      await expect(
        service.findOne('app-1', 'user-1', 'RECRUITER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
        email: 'other@test.com',
      });
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findOne('app-1', 'other-user', 'RECRUITER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const mockApplicationWithRelations = {
      ...mockApplication,
      job: {
        ...mockJob,
        createdBy: {
          id: 'recruiter-1',
          email: 'recruiter@test.com',
          fullName: 'Test Recruiter',
        },
      },
      candidate: {
        id: 'candidate-1',
        email: 'applicant@test.com',
        fullName: 'Test Applicant',
      },
    };

    it('should allow recruiter to update stage/status/notes', async () => {
      // Arrange
      const updateDto = {
        stage: ApplicationStage.INTERVIEW,
        status: ApplicationStatus.REVIEWING,
        notes: 'Good candidate',
      };
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockRecruiterUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);
      mockPrismaService.application.update.mockResolvedValue({
        ...mockApplication,
        ...updateDto,
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      });

      // Act
      const result = await service.update(
        'app-1',
        'recruiter-1',
        'RECRUITER',
        updateDto,
      );

      // Assert
      expect(result.stage).toBe(ApplicationStage.INTERVIEW);
      expect(result.status).toBe(ApplicationStatus.REVIEWING);
      expect(result.notes).toBe('Good candidate');
    });

    it('should set reviewedAt when status changes', async () => {
      // Arrange
      const updateDto = { status: ApplicationStatus.SHORTLISTED };
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockRecruiterUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);
      mockPrismaService.application.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.SHORTLISTED,
        reviewedAt: new Date(),
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      });

      // Act
      await service.update('app-1', 'recruiter-1', 'RECRUITER', updateDto);

      // Assert
      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw ForbiddenException when non-recruiter tries to update stage', async () => {
      // Arrange
      const updateDto = { stage: ApplicationStage.INTERVIEW };
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
        email: 'other@test.com',
      });
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('app-1', 'other-user', 'RECRUITER', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow applicant to update cover letter', async () => {
      // Arrange
      const updateDto = { coverLetter: 'Updated cover letter' };
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockPrismaService.application.update.mockResolvedValue({
        ...mockApplication,
        coverLetter: 'Updated cover letter',
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      });

      // Act
      const result = await service.update(
        'app-1',
        'user-1',
        'RECRUITER',
        updateDto,
      );

      // Assert
      expect(result.coverLetter).toBe('Updated cover letter');
    });

    it('should allow admin to update any field', async () => {
      // Arrange
      const updateDto = {
        stage: ApplicationStage.OFFER,
        notes: 'Admin notes',
      };
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'admin-1',
        role: Role.ADMIN,
      });
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);
      mockPrismaService.application.update.mockResolvedValue({
        ...mockApplication,
        ...updateDto,
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      });

      // Act
      const result = await service.update(
        'app-1',
        'admin-1',
        'ADMIN',
        updateDto,
      );

      // Assert
      expect(result.stage).toBe(ApplicationStage.OFFER);
    });
  });

  describe('remove', () => {
    const mockApplicationWithRelations = {
      ...mockApplication,
      job: {
        ...mockJob,
        createdBy: {
          id: 'recruiter-1',
          email: 'recruiter@test.com',
          fullName: 'Test Recruiter',
        },
      },
      candidate: {
        id: 'candidate-1',
        email: 'applicant@test.com',
        fullName: 'Test Applicant',
      },
    };

    it('should allow applicant to withdraw application', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(mockCandidate);
      mockPrismaService.application.update.mockResolvedValue({
        ...mockApplication,
        deletedAt: new Date(),
        status: ApplicationStatus.WITHDRAWN,
      });

      // Act
      await service.remove('app-1', 'user-1', 'RECRUITER');

      // Assert
      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: {
          deletedAt: expect.any(Date),
          status: 'WITHDRAWN',
        },
      });
    });

    it('should allow admin to delete any application', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'admin-1',
        role: Role.ADMIN,
      });
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);
      mockPrismaService.application.update.mockResolvedValue({
        ...mockApplication,
        deletedAt: new Date(),
        status: ApplicationStatus.WITHDRAWN,
      });

      // Act
      await service.remove('app-1', 'admin-1', 'ADMIN');

      // Assert
      expect(prisma.application.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when recruiter tries to delete', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue(mockRecruiterUser);
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove('app-1', 'recruiter-1', 'RECRUITER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-applicant tries to withdraw', async () => {
      // Arrange
      mockPrismaService.application.findUnique.mockResolvedValue(
        mockApplicationWithRelations,
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
        email: 'other@test.com',
      });
      mockPrismaService.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove('app-1', 'other-user', 'RECRUITER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
