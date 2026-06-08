import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { Role, WorkspaceMemberRole } from '@prisma/client';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: WorkspacesService;

  const mockWorkspacesService = {
    create: jest.fn(),
    addMember: jest.fn(),
    listMembers: jest.fn(),
    createInvitation: jest.fn(),
    acceptInvitation: jest.fn(),
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    fullName: 'Test User',
    role: Role.RECRUITER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        {
          provide: WorkspacesService,
          useValue: mockWorkspacesService,
        },
      ],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
    service = module.get<WorkspacesService>(WorkspacesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call workspacesService.create', async () => {
      const dto = { name: 'New Workspace', isBusiness: true };
      await controller.create(mockUser, dto);
      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
    });
  });

  describe('addMember', () => {
    it('should call workspacesService.addMember', async () => {
      const workspaceId = 'ws-1';
      const dto = { email: 'new@test.com', role: WorkspaceMemberRole.RECRUITER };
      await controller.addMember(workspaceId, mockUser, dto);
      expect(service.addMember).toHaveBeenCalledWith(workspaceId, mockUser.id, dto);
    });
  });

  describe('listMembers', () => {
    it('should call workspacesService.listMembers', async () => {
      const workspaceId = 'ws-1';
      await controller.listMembers(workspaceId, mockUser);
      expect(service.listMembers).toHaveBeenCalledWith(workspaceId, mockUser.id);
    });
  });

  describe('createInvitation', () => {
    it('should call workspacesService.createInvitation', async () => {
      const workspaceId = 'ws-1';
      const dto = { email: 'invite@test.com', role: WorkspaceMemberRole.ADMIN };
      await controller.createInvitation(workspaceId, mockUser, dto);
      expect(service.createInvitation).toHaveBeenCalledWith(workspaceId, mockUser.id, dto);
    });
  });

  describe('acceptInvitation', () => {
    it('should call workspacesService.acceptInvitation', async () => {
      const dto = { token: 'token-123' };
      await controller.acceptInvitation(mockUser, dto);
      expect(service.acceptInvitation).toHaveBeenCalledWith(mockUser.id, dto.token);
    });
  });
});
