import { Test, TestingModule } from '@nestjs/testing';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { QueryInterviewsDto } from './dto/query-interviews.dto';

describe('InterviewsController', () => {
  let controller: InterviewsController;
  let service: InterviewsService;

  const mockInterviewsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockInterview = {
    id: '1',
    applicationId: 'app-1',
    interviewerId: 'int-1',
    scheduledAt: new Date(),
    status: 'SCHEDULED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewsController],
      providers: [
        {
          provide: InterviewsService,
          useValue: mockInterviewsService,
        },
      ],
    }).compile();

    controller = module.get<InterviewsController>(InterviewsController);
    service = module.get<InterviewsService>(InterviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an interview', async () => {
      const createDto: CreateInterviewDto = {
        applicationId: 'app-1',
        interviewerId: 'int-1',
        scheduledAt: new Date().toISOString(),
      };

      mockInterviewsService.create.mockResolvedValue(mockInterview);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockInterview);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated interviews', async () => {
      const query: QueryInterviewsDto = { page: 1, limit: 10 };
      const expectedResult = {
        data: [mockInterview],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };

      mockInterviewsService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a single interview', async () => {
      mockInterviewsService.findOne.mockResolvedValue(mockInterview);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockInterview);
      expect(service.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update and return an interview', async () => {
      const updateDto: UpdateInterviewDto = { status: 'COMPLETED' };
      const expectedResult = { ...mockInterview, status: 'COMPLETED' };

      mockInterviewsService.update.mockResolvedValue(expectedResult);

      const result = await controller.update('1', updateDto);

      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith('1', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete an interview', async () => {
      mockInterviewsService.remove.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith('1');
    });
  });
});
