/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceContextService } from '../common/services/workspace-context.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;
  let prisma: DeepMockProxy<PrismaClient>;
  let workspaceContext: WorkspaceContextService;

  const mockWorkspaceId = 'ws-123';

  beforeEach(async () => {
    const workspaceContextMock = {
      getWorkspaceId: jest.fn().mockReturnValue(mockWorkspaceId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplatesService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: WorkspaceContextService, useValue: workspaceContextMock },
      ],
    }).compile();

    service = module.get<EmailTemplatesService>(EmailTemplatesService);
    prisma = module.get(PrismaService);
    workspaceContext = module.get(WorkspaceContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an email template', async () => {
      const dto = {
        name: 'Welcome',
        subject: 'Welcome to our platform',
        body: 'Hello!',
      };
      const expectedTemplate = {
        id: 'tpl-1',
        ...dto,
        workspaceId: mockWorkspaceId,
      };

      prisma.emailTemplate.create.mockResolvedValue(expectedTemplate as any);

      const result = await service.create(dto);

      expect(workspaceContext.getWorkspaceId).toHaveBeenCalled();
      expect(prisma.emailTemplate.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          workspaceId: mockWorkspaceId,
        },
      });
      expect(result).toEqual(expectedTemplate);
    });
  });

  describe('findAll', () => {
    it('should return paginated templates with no filters', async () => {
      const templates = [{ id: 'tpl-1' }, { id: 'tpl-2' }];
      prisma.emailTemplate.findMany.mockResolvedValue(templates as any);
      prisma.emailTemplate.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(workspaceContext.getWorkspaceId).toHaveBeenCalled();
      expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        data: templates,
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('should apply search filters', async () => {
      prisma.emailTemplate.findMany.mockResolvedValue([]);
      prisma.emailTemplate.count.mockResolvedValue(0);

      await service.findAll({ search: 'welcome', page: 2, limit: 5 });

      expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          OR: [
            { name: { contains: 'welcome', mode: 'insensitive' } },
            { subject: { contains: 'welcome', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });
  });

  describe('findOne', () => {
    it('should return a template if found', async () => {
      const template = { id: 'tpl-1' };
      prisma.emailTemplate.findFirst.mockResolvedValue(template as any);

      const result = await service.findOne('tpl-1');

      expect(workspaceContext.getWorkspaceId).toHaveBeenCalled();
      expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', workspaceId: mockWorkspaceId },
      });
      expect(result).toEqual(template);
    });

    it('should throw NotFoundException if template not found', async () => {
      prisma.emailTemplate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('tpl-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an existing template', async () => {
      const dto = { subject: 'Updated Subject' };
      const existingTemplate = { id: 'tpl-1' };
      const updatedTemplate = { ...existingTemplate, ...dto };

      // Mock findOne (which uses prisma.emailTemplate.findFirst)
      prisma.emailTemplate.findFirst.mockResolvedValue(existingTemplate as any);
      prisma.emailTemplate.update.mockResolvedValue(updatedTemplate as any);

      const result = await service.update('tpl-1', dto);

      expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', workspaceId: mockWorkspaceId },
      });
      expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
        data: { subject: 'Updated Subject' },
      });
      expect(result).toEqual(updatedTemplate);
    });
  });

  describe('remove', () => {
    it('should delete an existing template', async () => {
      const existingTemplate = { id: 'tpl-1' };

      prisma.emailTemplate.findFirst.mockResolvedValue(existingTemplate as any);
      prisma.emailTemplate.delete.mockResolvedValue(existingTemplate as any);

      await service.remove('tpl-1');

      expect(prisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', workspaceId: mockWorkspaceId },
      });
      expect(prisma.emailTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'tpl-1' },
      });
    });
  });
});
