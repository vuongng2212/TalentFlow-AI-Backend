import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceMemberRole } from '@prisma/client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import {
  CreateInvitationDto,
  AcceptInvitationDto,
} from './dto/create-invitation.dto';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;
  let service: jest.Mocked<WorkspacesService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'RECRUITER',
    fullName: 'Test User',
  };

  const mockWorkspaceId = 'ws-123';

  beforeEach(async () => {
    const mockWorkspacesService = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      addMember: jest.fn(),
      listMembers: jest.fn(),
      createInvitation: jest.fn(),
      acceptInvitation: jest.fn(),
      removeMember: jest.fn(),
    };

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
    service = module.get(WorkspacesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with correct parameters', async () => {
      const dto: CreateWorkspaceDto = { name: 'New Workspace' };
      const expectedResult = {
        id: mockWorkspaceId,
        name: 'New Workspace',
        isBusiness: false,
      };

      service.create.mockResolvedValue(expectedResult as any);

      const result = await controller.create(mockUser, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('listMyWorkspaces', () => {
    it('should call service.findAllForUser with correct user id', async () => {
      const expectedResult = [{ id: mockWorkspaceId, name: 'Workspace 1' }];

      service.findAllForUser.mockResolvedValue(expectedResult as any);

      const result = await controller.listMyWorkspaces(mockUser);

      expect(service.findAllForUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getOne', () => {
    it('should call service.findOne with correct parameters', async () => {
      const expectedResult = { id: mockWorkspaceId, name: 'Workspace 1' };

      service.findOne.mockResolvedValue(expectedResult as any);

      const result = await controller.getOne(mockWorkspaceId, mockUser);

      expect(service.findOne).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUser.id,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateWorkspace', () => {
    it('should call service.update with correct parameters', async () => {
      const dto: UpdateWorkspaceDto = { name: 'Updated Workspace' };
      const expectedResult = { id: mockWorkspaceId, name: 'Updated Workspace' };

      service.update.mockResolvedValue(expectedResult as any);

      const result = await controller.updateWorkspace(
        mockWorkspaceId,
        mockUser,
        dto,
      );

      expect(service.update).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUser.id,
        dto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('addMember', () => {
    it('should call service.addMember with correct parameters', async () => {
      const dto: AddWorkspaceMemberDto = {
        userId: 'user-456',
        role: WorkspaceMemberRole.RECRUITER,
      };
      const expectedResult = { id: 'membership-123', userId: 'user-456' };

      service.addMember.mockResolvedValue(expectedResult as any);

      const result = await controller.addMember(mockWorkspaceId, mockUser, dto);

      expect(service.addMember).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUser.id,
        dto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('listMembers', () => {
    it('should call service.listMembers with correct parameters', async () => {
      const expectedResult = [
        { id: 'membership-123', user: { fullName: 'Test' } },
      ];

      service.listMembers.mockResolvedValue(expectedResult as any);

      const result = await controller.listMembers(mockWorkspaceId, mockUser);

      expect(service.listMembers).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUser.id,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createInvitation', () => {
    it('should call service.createInvitation with correct parameters', async () => {
      const dto: CreateInvitationDto = {
        email: 'invite@example.com',
        role: WorkspaceMemberRole.RECRUITER,
      };
      const expectedResult = {
        id: 'invitation-123',
        email: 'invite@example.com',
      };

      service.createInvitation.mockResolvedValue(expectedResult as any);

      const result = await controller.createInvitation(
        mockWorkspaceId,
        mockUser,
        dto,
      );

      expect(service.createInvitation).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUser.id,
        dto,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('acceptInvitation', () => {
    it('should call service.acceptInvitation with correct parameters', async () => {
      const dto: AcceptInvitationDto = { token: 'valid-token' };
      const expectedResult = { id: 'membership-123', status: 'ACTIVE' };

      service.acceptInvitation.mockResolvedValue(expectedResult as any);

      const result = await controller.acceptInvitation(mockUser, dto);

      expect(service.acceptInvitation).toHaveBeenCalledWith(
        mockUser.id,
        dto.token,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('removeMember', () => {
    it('should call service.removeMember with correct parameters', async () => {
      const targetUserId = 'user-456';

      service.removeMember.mockResolvedValue(undefined);

      await controller.removeMember(mockWorkspaceId, targetUserId, mockUser);

      expect(service.removeMember).toHaveBeenCalledWith(
        mockWorkspaceId,
        mockUser.id,
        targetUserId,
      );
    });
  });
});
