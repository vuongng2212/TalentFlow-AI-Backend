/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { CvUploadService } from './cv-upload.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import {
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApplicationStage,
  ApplicationStatus,
  JobStatus,
  Role,
  PrismaClient,
  CvParsingStatus,
} from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';

describe('CvUploadService', () => {
  let service: CvUploadService;
  let prisma: DeepMockProxy<PrismaClient>;

  const mockUser = {
    id: 'user-1',
    email: 'applicant@test.com',
    fullName: 'Test Applicant',
    role: Role.APPLICANT,
  };

  const mockCandidate = {
    id: 'candidate-1',
    email: 'applicant@test.com',
    fullName: 'Test Applicant',
    workspaceId: 'ws-test-1',
  };

  const mockJob = {
    id: 'job-1',
    title: 'Senior Developer',
    status: JobStatus.OPEN,
    createdById: 'recruiter-1',
    deletedAt: null,
    workspaceId: 'ws-test-1',
  };

  const mockApplication = {
    id: 'app-1',
    jobId: 'job-1',
    candidateId: 'candidate-1',
    stage: ApplicationStage.APPLIED,
    status: ApplicationStatus.SUBMITTED,
    cvParsingStatus: CvParsingStatus.PENDING,
    appliedAt: new Date(),
    workspaceId: 'ws-test-1',
  };

  const mockStorageService = {
    upload: jest.fn(),
    getSignedUrl: jest.fn(),
    delete: jest.fn(),
    getBucketName: jest.fn().mockReturnValue('talentflow-cvs'),
  };

  const mockQueueService = {
    publishCvUploaded: jest.fn(),
    publishApplicationCreated: jest.fn(),
  };

  const mockWorkspaceContextService = {
    getWorkspaceId: jest.fn().mockReturnValue('ws-test-1'),
  };

  const mockFile = {
    originalname: 'resume.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('fake pdf content'),
  } as Express.Multer.File;

  beforeEach(async () => {
    mockQueueService.publishCvUploaded.mockReset().mockResolvedValue(undefined);
    mockQueueService.publishApplicationCreated
      .mockReset()
      .mockResolvedValue(undefined);
    mockStorageService.upload.mockReset();
    mockStorageService.getSignedUrl.mockReset();
    mockStorageService.delete.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CvUploadService,
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

    service = module.get<CvUploadService>(CvUploadService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWithCv', () => {
    const dto = { jobId: 'job-1', coverLetter: 'Hello' };

    it('should process CV upload successfully on happy path', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob as any);
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate as any);
      prisma.application.findFirst.mockResolvedValue(null);
      mockStorageService.upload.mockResolvedValue({
        key: 'cvs/resume.pdf',
        url: 'http://storage/cvs/resume.pdf',
      });
      prisma.application.create.mockResolvedValue(mockApplication as any);
      mockStorageService.getSignedUrl.mockResolvedValue(
        'http://storage/signed/resume.pdf',
      );

      const result = await service.createWithCv('user-1', mockFile, dto);

      expect(result).toEqual({
        applicationId: 'app-1',
        fileKey: expect.any(String),
        fileUrl: 'http://storage/cvs/resume.pdf',
        presignedUrl: 'http://storage/signed/resume.pdf',
        status: 'processing',
        message: 'CV uploaded successfully. Processing started.',
      });
      expect(mockQueueService.publishCvUploaded).toHaveBeenCalled();
      expect(mockQueueService.publishApplicationCreated).toHaveBeenCalled();
    });

    it('should throw ConflictException if applicant has already applied', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob as any);
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate as any);
      prisma.application.findFirst.mockResolvedValue(mockApplication as any);

      await expect(
        service.createWithCv('user-1', mockFile, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException and log error if storage upload fails', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob as any);
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate as any);
      prisma.application.findFirst.mockResolvedValue(null);
      mockStorageService.upload.mockRejectedValue(new Error('S3 error'));

      await expect(
        service.createWithCv('user-1', mockFile, dto),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should rollback application and storage on event publishing failure', async () => {
      prisma.job.findFirst.mockResolvedValue(mockJob as any);
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate as any);
      prisma.application.findFirst.mockResolvedValue(null);
      mockStorageService.upload.mockResolvedValue({
        key: 'cvs/resume.pdf',
        url: 'http://storage/cvs/resume.pdf',
      });
      prisma.application.create.mockResolvedValue(mockApplication as any);
      mockQueueService.publishCvUploaded.mockRejectedValue(
        new Error('Queue down'),
      );
      prisma.application.delete.mockResolvedValue({} as any);
      mockStorageService.delete.mockResolvedValue(undefined);

      await expect(
        service.createWithCv('user-1', mockFile, dto),
      ).rejects.toThrow(InternalServerErrorException);

      expect(prisma.application.delete).toHaveBeenCalledWith({
        where: { id: 'app-1' },
      });
      expect(mockStorageService.delete).toHaveBeenCalled();
    });
  });

  describe('ingestApplication', () => {
    const ingestionDto = {
      jobId: 'job-1',
      candidateEmail: 'cand@test.com',
      candidateName: 'Ingest Candidate',
      coverLetter: 'Cover',
      externalMessageId: 'msg-123',
    };

    it('should ingest application successfully', async () => {
      prisma.application.findFirst
        .mockResolvedValueOnce(null) // idempotency check
        .mockResolvedValueOnce(null); // deduplication check
      prisma.job.findFirst.mockResolvedValue(mockJob as any);
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate as any);
      mockStorageService.upload.mockResolvedValue({
        key: 'cvs/resume.pdf',
        url: 'http://storage/cvs/resume.pdf',
      });
      prisma.application.create.mockResolvedValue(mockApplication as any);

      const result = await service.ingestApplication(
        'ws-test-1',
        mockFile,
        ingestionDto,
      );

      expect(result).toEqual({
        success: true,
        data: {
          applicationId: 'app-1',
          candidateId: 'candidate-1',
          status: 'processing',
          message: 'CV ingestion initiated successfully.',
        },
      });
    });

    it('should block duplicate ingestion via externalMessageId (idempotency)', async () => {
      prisma.application.findFirst.mockResolvedValue(mockApplication as any);

      await expect(
        service.ingestApplication('ws-test-1', mockFile, ingestionDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if job is not OPEN', async () => {
      prisma.application.findFirst.mockResolvedValue(null);
      prisma.job.findFirst.mockResolvedValue({
        ...mockJob,
        status: JobStatus.CLOSED,
      } as any);

      await expect(
        service.ingestApplication('ws-test-1', mockFile, ingestionDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
