/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  JobStatus,
  EmploymentType,
  Role,
  PrismaClient,
  User,
  Application,
} from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let prisma: DeepMockProxy<PrismaClient>;

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
    workspaceId: 'ws-test-1',
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
    workspaceId: 'ws-test-1',
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

  const mockStorageService = {
    upload: jest.fn(),
    getSignedUrl: jest.fn(),
    delete: jest.fn(),
    getBucketName: jest.fn().mockReturnValue('talentflow-cvs'),
  };

  const MOCK_WORKSPACE_ID = 'ws-test-1';

  const mockWorkspaceContextService = {
    getWorkspaceId: jest.fn().mockReturnValue(MOCK_WORKSPACE_ID),
  };

  const mockQueueService = {
    publishCvUploaded: jest.fn(),
    publishApplicationCreated: jest.fn(),
    isHealthy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaClient>(),
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: WorkspaceContextService,
          useValue: mockWorkspaceContextService,
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an application successfully', async () => {
      // Arrange
      const createDto = { jobId: 'job-1', coverLetter: 'I am interested' };
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.application.create.mockResolvedValue({
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
      } as never);

      // Act
      const result = await service.create('user-1', createDto);

      // Assert
      expect(result.jobId).toBe('job-1');
      expect(result.candidateId).toBe('candidate-1');
      expect(prisma.application.create).toHaveBeenCalled();
      expect(mockQueueService.publishApplicationCreated).toHaveBeenCalledWith({
        applicationId: 'app-1',
        jobId: 'job-1',
        jobTitle: 'Senior Developer',
        applicantId: 'candidate-1',
        applicantEmail: 'applicant@test.com',
        applicantName: 'Test Applicant',
        appliedAt: expect.any(String),
      });
    });

    it('should throw NotFoundException when job not found', async () => {
      // Arrange
      const createDto = { jobId: 'non-existent-job' };
      prisma.job.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create('user-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when job is soft deleted', async () => {
      // Arrange
      const createDto = { jobId: 'deleted-job' };
      prisma.job.findFirst.mockResolvedValue({
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
      prisma.job.findFirst.mockResolvedValue({
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
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create('non-existent-user', createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create candidate if not exists', async () => {
      // Arrange
      const createDto = { jobId: 'job-1' };
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.candidate.create.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.application.create.mockResolvedValue({
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
      } as never);

      // Act
      await service.create('user-1', createDto);

      // Assert
      expect(prisma.candidate.create).toHaveBeenCalledWith({
        data: {
          email: mockUser.email,
          fullName: mockUser.fullName,
          workspaceId: MOCK_WORKSPACE_ID,
        },
      });
    });

    it('should throw ConflictException when already applied', async () => {
      // Arrange
      const createDto = { jobId: 'job-1' };
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(
        mockApplication as unknown as Application,
      );

      // Act & Assert
      await expect(service.create('user-1', createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('createWithCv', () => {
    const mockFile = {
      originalname: 'resume.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('pdf-content'),
    } as Express.Multer.File;

    it('should upload CV, create application, and publish queue event', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(null);
      mockStorageService.upload.mockResolvedValue({
        key: 'cvs/file.pdf',
        url: 'http://localhost:9000/talentflow-cvs/cvs/file.pdf',
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      prisma.application.create.mockResolvedValue({
        ...mockApplication,
        cvFileKey: 'cvs/file.pdf',
        cvFileUrl: 'http://localhost:9000/talentflow-cvs/cvs/file.pdf',
      } as never);
      mockQueueService.publishCvUploaded.mockResolvedValue(undefined);
      mockQueueService.publishApplicationCreated.mockResolvedValue(undefined);
      mockStorageService.getSignedUrl.mockResolvedValue('https://signed-url');

      const result = await service.createWithCv('user-1', mockFile, {
        jobId: 'job-1',
        coverLetter: 'I am interested',
      });

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        mockFile.buffer,
        expect.stringMatching(/^cvs\/[0-9a-f-]{36}\.pdf$/),
        'application/pdf',
      );
      expect(mockQueueService.publishCvUploaded).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateId: 'candidate-1',
          applicationId: 'app-1',
          jobId: 'job-1',
          bucket: 'talentflow-cvs',
          fileKey: expect.stringMatching(/^cvs\/[0-9a-f-]{36}\.pdf$/),
          mimeType: 'application/pdf',
        }),
      );
      expect(mockQueueService.publishCvUploaded).toHaveBeenCalledWith(
        expect.not.objectContaining({
          fileUrl: expect.anything(),
        }),
      );
      expect(mockQueueService.publishApplicationCreated).toHaveBeenCalledWith({
        applicationId: 'app-1',
        jobId: 'job-1',
        jobTitle: 'Senior Developer',
        applicantId: 'candidate-1',
        applicantEmail: 'applicant@test.com',
        applicantName: 'Test Applicant',
        appliedAt: expect.any(String),
      });
      expect(result).toEqual(
        expect.objectContaining({
          applicationId: 'app-1',
          status: 'processing',
          message: 'CV uploaded successfully. Processing started.',
          presignedUrl: 'https://signed-url',
        }),
      );
    });

    it('should throw InternalServerErrorException when upload fails', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(null);
      mockStorageService.upload.mockRejectedValue(new Error('upload failed'));

      // Silence the logger error for this test
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      await expect(
        service.createWithCv('user-1', mockFile, { jobId: 'job-1' }),
      ).rejects.toThrow(InternalServerErrorException);

      loggerSpy.mockRestore();
    });

    it('should rollback created application and file when queue publish fails', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob);
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findFirst.mockResolvedValue(null);
      mockStorageService.upload.mockResolvedValue({
        key: 'cvs/file.pdf',
        url: 'http://localhost:9000/talentflow-cvs/cvs/file.pdf',
      });
      prisma.application.create.mockResolvedValue({
        ...mockApplication,
        cvFileKey: 'cvs/file.pdf',
        cvFileUrl: 'http://localhost:9000/talentflow-cvs/cvs/file.pdf',
      } as never);
      mockQueueService.publishCvUploaded.mockRejectedValue(
        new Error('queue failed'),
      );
      prisma.application.delete.mockResolvedValue({} as unknown as Application);
      mockStorageService.delete.mockResolvedValue(undefined);

      // Silence the logger error for this test
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation();

      const resultPromise = service.createWithCv('user-1', mockFile, {
        jobId: 'job-1',
      });

      await expect(resultPromise).rejects.toThrow(InternalServerErrorException);
      await expect(resultPromise).rejects.toThrow(
        'Failed to process CV upload',
      );

      expect(prisma.application.delete).toHaveBeenCalledWith({
        where: { id: 'app-1' },
      });
      expect(mockStorageService.delete).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });
  });

  describe('findAll', () => {
    it('should return paginated applications for recruiter', async () => {
      // Arrange
      const query = { page: 1, limit: 10 };
      prisma.application.findMany.mockResolvedValue([
        mockApplication,
      ] as unknown as Application[]);
      prisma.application.count.mockResolvedValue(1);

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
      prisma.application.findMany.mockResolvedValue([]);
      prisma.application.count.mockResolvedValue(0);

      // Act
      await service.findAll('recruiter-1', 'RECRUITER', query);

      // Assert
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            job: {
              createdById: 'recruiter-1',
              workspaceId: MOCK_WORKSPACE_ID,
            },
          }),
        }),
      );
    });

    it('should filter by candidate for non-admin users', async () => {
      // Arrange
      const query = { page: 1, limit: 10 };
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.findMany.mockResolvedValue([]);
      prisma.application.count.mockResolvedValue(0);

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
      prisma.application.findMany.mockResolvedValue([]);
      prisma.application.count.mockResolvedValue(0);

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
      prisma.application.findMany.mockResolvedValue([]);
      prisma.application.count.mockResolvedValue(0);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(
        mockRecruiterUser as unknown as User,
      );
      prisma.candidate.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findOne('app-1', 'admin-1', 'ADMIN');

      // Assert
      expect(result).toEqual(mockApplicationWithRelations);
    });

    it('should return application when user is the applicant', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);

      // Act
      const result = await service.findOne('app-1', 'user-1', 'RECRUITER');

      // Assert
      expect(result).toEqual(mockApplicationWithRelations);
    });

    it('should return application when user is the job recruiter', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(
        mockRecruiterUser as unknown as User,
      );
      prisma.candidate.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.findOne('app-1', 'recruiter-1', 'RECRUITER');

      // Assert
      expect(result).toEqual(mockApplicationWithRelations);
    });

    it('should throw NotFoundException when application not found', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.findOne('non-existent', 'user-1', 'RECRUITER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when application is soft deleted', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue({
        ...mockApplicationWithRelations,
        deletedAt: new Date(),
      } as never);

      // Act & Assert
      await expect(
        service.findOne('app-1', 'user-1', 'RECRUITER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user has no access', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
        email: 'other@test.com',
      } as never);
      prisma.candidate.findUnique.mockResolvedValue(null);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(
        mockRecruiterUser as unknown as User,
      );
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.application.update.mockResolvedValue({
        ...mockApplication,
        ...updateDto,
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      } as never);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(
        mockRecruiterUser as unknown as User,
      );
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.application.update.mockResolvedValue({
        ...mockApplication,
        status: ApplicationStatus.SHORTLISTED,
        reviewedAt: new Date(),
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      } as never);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
        email: 'other@test.com',
      } as never);
      prisma.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update('app-1', 'other-user', 'RECRUITER', updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow applicant to update cover letter', async () => {
      // Arrange
      const updateDto = { coverLetter: 'Updated cover letter' };
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.update.mockResolvedValue({
        ...mockApplication,
        coverLetter: 'Updated cover letter',
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      } as never);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'admin-1',
        role: Role.ADMIN,
      } as never);
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.application.update.mockResolvedValue({
        ...mockApplication,
        ...updateDto,
        job: { id: 'job-1', title: 'Senior Developer' },
        candidate: {
          id: 'candidate-1',
          email: 'applicant@test.com',
          fullName: 'Test Applicant',
        },
      } as never);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(mockUser as unknown as User);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);
      prisma.application.update.mockResolvedValue({
        ...mockApplication,
        deletedAt: new Date(),
        status: ApplicationStatus.WITHDRAWN,
      } as never);

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
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'admin-1',
        role: Role.ADMIN,
      } as never);
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.application.update.mockResolvedValue({
        ...mockApplication,
        deletedAt: new Date(),
        status: ApplicationStatus.WITHDRAWN,
      } as never);

      // Act
      await service.remove('app-1', 'admin-1', 'ADMIN');

      // Assert
      expect(prisma.application.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when recruiter tries to delete', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue(
        mockRecruiterUser as unknown as User,
      );
      prisma.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove('app-1', 'recruiter-1', 'RECRUITER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when non-applicant tries to withdraw', async () => {
      // Arrange
      prisma.application.findFirst.mockResolvedValue(
        mockApplicationWithRelations as any,
      );
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'other-user',
        email: 'other@test.com',
      } as never);
      prisma.candidate.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.remove('app-1', 'other-user', 'RECRUITER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
