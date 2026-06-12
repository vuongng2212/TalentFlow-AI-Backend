/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role } from '@prisma/client';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOneProfile: jest.fn(),
    updateProfile: jest.fn(),
    updateRole: jest.fn(),
    softDeleteUser: jest.fn(),
  };

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    fullName: 'Test User',
    role: Role.INTERVIEWER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserPayload = {
    id: '1',
    email: 'test@example.com',
    role: Role.INTERVIEWER,
    fullName: 'Test User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return a paginated list of users', async () => {
      const queryDto: QueryUsersDto = { page: 1, limit: 10 };
      const expectedResult = {
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };

      mockUsersService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(queryDto);

      expect(result).toEqual(expectedResult);
      expect(jest.mocked(service.findAll)).toHaveBeenCalledWith(queryDto);
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      mockUsersService.findOneProfile.mockResolvedValue(mockUser);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockUser);
      expect(jest.mocked(service.findOneProfile)).toHaveBeenCalledWith('1');
    });
  });

  describe('update', () => {
    it('should update and return a user', async () => {
      const updateUserDto: UpdateUserDto = { fullName: 'Updated Name' };
      const expectedResult = { ...mockUser, fullName: 'Updated Name' };

      mockUsersService.updateProfile.mockResolvedValue(expectedResult);

      const result = await controller.update(
        '1',
        mockUserPayload,
        updateUserDto,
      );

      expect(result).toEqual(expectedResult);
      expect(jest.mocked(service.updateProfile)).toHaveBeenCalledWith(
        '1',
        mockUserPayload.id,
        mockUserPayload.role,
        updateUserDto,
      );
    });
  });

  describe('updateRole', () => {
    it('should update user role and return user', async () => {
      const updateRoleDto: UpdateRoleDto = { role: Role.RECRUITER };
      const expectedResult = { ...mockUser, role: Role.RECRUITER };

      mockUsersService.updateRole.mockResolvedValue(expectedResult);

      const result = await controller.updateRole('1', updateRoleDto);

      expect(result).toEqual(expectedResult);
      expect(jest.mocked(service.updateRole)).toHaveBeenCalledWith(
        '1',
        Role.RECRUITER,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete a user', async () => {
      mockUsersService.softDeleteUser.mockResolvedValue(undefined);

      await controller.remove('1');

      expect(jest.mocked(service.softDeleteUser)).toHaveBeenCalledWith('1');
    });
  });
});
