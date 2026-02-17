/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { JobStatus, EmploymentType, Role } from '@prisma/client';

describe('JobsController', () => {
  let controller: JobsController;
  let service: JobsService;

  const mockUser = {
    id: 'user-1',
    email: 'recruiter@test.com',
    role: Role.RECRUITER,
    fullName: 'Test Recruiter',
  };

  const mockJob = {
    id: 'job-1',
    title: 'Senior Developer',
    description: 'Test description',
    department: 'Engineering',
    location: 'Remote',
    employmentType: EmploymentType.FULL_TIME,
    salaryMin: 80000,
    salaryMax: 120000,
    requirements: { skills: ['typescript', 'nestjs'] },
    status: JobStatus.OPEN,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockJobsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    service = module.get<JobsService>(JobsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new job', async () => {
      const createJobDto: CreateJobDto = {
        title: 'Senior Developer',
        description: 'Test description',
        department: 'Engineering',
        location: 'Remote',
        employmentType: EmploymentType.FULL_TIME,
        salaryMin: 80000,
        salaryMax: 120000,
        status: JobStatus.OPEN,
      };

      mockJobsService.create.mockResolvedValue(mockJob);

      const result = await controller.create(mockUser, createJobDto);

      expect(result).toEqual(mockJob);
      expect(service.create).toHaveBeenCalledWith(mockUser.id, createJobDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated jobs', async () => {
      const query: QueryJobsDto = { page: 1, limit: 10 };
      const expectedResult = {
        data: [mockJob],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };

      mockJobsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass filter parameters to service', async () => {
      const query: QueryJobsDto = {
        page: 1,
        limit: 10,
        status: JobStatus.OPEN,
        employmentType: EmploymentType.FULL_TIME,
        search: 'developer',
      };

      mockJobsService.findAll.mockResolvedValue({ data: [], meta: {} });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a job by id', async () => {
      mockJobsService.findOne.mockResolvedValue(mockJob);

      const result = await controller.findOne('job-1');

      expect(result).toEqual(mockJob);
      expect(service.findOne).toHaveBeenCalledWith('job-1');
    });
  });

  describe('update', () => {
    it('should update a job', async () => {
      const updateJobDto: UpdateJobDto = { title: 'Updated Title' };
      const updatedJob = { ...mockJob, title: 'Updated Title' };

      mockJobsService.update.mockResolvedValue(updatedJob);

      const result = await controller.update('job-1', mockUser, updateJobDto);

      expect(result).toEqual(updatedJob);
      expect(service.update).toHaveBeenCalledWith(
        'job-1',
        mockUser.id,
        mockUser.role,
        updateJobDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete a job', async () => {
      mockJobsService.remove.mockResolvedValue(undefined);

      await controller.remove('job-1', mockUser);

      expect(service.remove).toHaveBeenCalledWith(
        'job-1',
        mockUser.id,
        mockUser.role,
      );
    });
  });
});
