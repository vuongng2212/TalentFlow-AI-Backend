/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { QueryApplicationsDto } from './dto/query-applications.dto';
import {
  ApplicationStatus,
  ApplicationStage,
  Role,
} from '@prisma/client';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: ApplicationsService;

  const mockUser = {
    id: 'user-1',
    email: 'applicant@test.com',
    role: Role.RECRUITER,
    fullName: 'Test Applicant',
  };

  const mockRecruiterUser = {
    id: 'recruiter-1',
    email: 'recruiter@test.com',
    role: Role.RECRUITER,
    fullName: 'Test Recruiter',
  };

  const mockApplication = {
    id: 'app-1',
    jobId: 'job-1',
    candidateId: 'candidate-1',
    coverLetter: 'I am interested',
    stage: ApplicationStage.APPLICATION,
    status: ApplicationStatus.SUBMITTED,
    notes: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
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
  };

  const mockApplicationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        {
          provide: ApplicationsService,
          useValue: mockApplicationsService,
        },
      ],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    service = module.get<ApplicationsService>(ApplicationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an application', async () => {
      const createDto: CreateApplicationDto = {
        jobId: 'job-1',
        coverLetter: 'I am interested',
      };

      mockApplicationsService.create.mockResolvedValue(mockApplication);

      const result = await controller.create(mockUser, createDto);

      expect(result).toEqual(mockApplication);
      expect(service.create).toHaveBeenCalledWith(mockUser.id, createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated applications', async () => {
      const query: QueryApplicationsDto = { page: 1, limit: 10 };
      const expectedResult = {
        data: [mockApplication],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };

      mockApplicationsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(mockUser, query);

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.role,
        query,
      );
    });

    it('should pass filter parameters to service', async () => {
      const query: QueryApplicationsDto = {
        page: 1,
        limit: 10,
        jobId: 'job-1',
        status: ApplicationStatus.SUBMITTED,
        stage: ApplicationStage.APPLICATION,
      };

      mockApplicationsService.findAll.mockResolvedValue({
        data: [],
        meta: {},
      });

      await controller.findAll(mockRecruiterUser, query);

      expect(service.findAll).toHaveBeenCalledWith(
        mockRecruiterUser.id,
        mockRecruiterUser.role,
        query,
      );
    });
  });

  describe('findOne', () => {
    it('should return an application by id', async () => {
      mockApplicationsService.findOne.mockResolvedValue(mockApplication);

      const result = await controller.findOne('app-1', mockUser);

      expect(result).toEqual(mockApplication);
      expect(service.findOne).toHaveBeenCalledWith(
        'app-1',
        mockUser.id,
        mockUser.role,
      );
    });
  });

  describe('update', () => {
    it('should update an application', async () => {
      const updateDto: UpdateApplicationDto = {
        status: ApplicationStatus.REVIEWING,
        notes: 'Good candidate',
      };
      const updatedApplication = {
        ...mockApplication,
        ...updateDto,
      };

      mockApplicationsService.update.mockResolvedValue(updatedApplication);

      const result = await controller.update('app-1', mockRecruiterUser, updateDto);

      expect(result).toEqual(updatedApplication);
      expect(service.update).toHaveBeenCalledWith(
        'app-1',
        mockRecruiterUser.id,
        mockRecruiterUser.role,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should withdraw an application', async () => {
      mockApplicationsService.remove.mockResolvedValue(undefined);

      await controller.remove('app-1', mockUser);

      expect(service.remove).toHaveBeenCalledWith(
        'app-1',
        mockUser.id,
        mockUser.role,
      );
    });
  });
});
