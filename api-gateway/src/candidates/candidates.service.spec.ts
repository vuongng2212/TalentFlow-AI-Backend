import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceContextService } from '../common/services/workspace-context.service';

const WORKSPACE_ID = 'workspace-1';

const mockPrismaService = {
  candidate: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockWorkspaceContext = {
  getWorkspaceId: jest.fn().mockReturnValue(WORKSPACE_ID),
};

describe('CandidatesService (Workspace-Scoped Isolation)', () => {
  let service: CandidatesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: WorkspaceContextService, useValue: mockWorkspaceContext },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll - workspace isolation', () => {
    it('should return paginated candidates scoped to the current workspace', async () => {
      const mockCandidates = [
        {
          id: '1',
          fullName: 'Alice',
          email: 'alice@test.com',
          workspaceId: WORKSPACE_ID,
          _count: { applications: 2 },
        },
      ];
      prisma.candidate.findMany.mockResolvedValue(mockCandidates);
      prisma.candidate.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockCandidates);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: WORKSPACE_ID }),
        }),
      );
    });

    it('should apply search filter combined with workspaceId', async () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      prisma.candidate.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, search: 'alice' });

      expect(prisma.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            OR: expect.arrayContaining([
              { fullName: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
            ] as unknown[]),
          }),
        }),
      );
    });
  });

  describe('findOne - workspace isolation', () => {
    it('should look up by id AND workspaceId so cross-tenant access returns 404', async () => {
      const mockCandidate = {
        id: '1',
        fullName: 'Alice',
        workspaceId: WORKSPACE_ID,
        applications: [],
      };
      prisma.candidate.findFirst.mockResolvedValue(mockCandidate);

      const result = await service.findOne('1');
      expect(result).toEqual(mockCandidate);
      expect(prisma.candidate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1', workspaceId: WORKSPACE_ID },
        }),
      );
    });

    it('should throw NotFoundException when candidate is from another workspace', async () => {
      prisma.candidate.findFirst.mockResolvedValue(null);

      await expect(service.findOne('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update - workspace isolation', () => {
    it('should update candidate within the current workspace', async () => {
      const existing = { id: '1', fullName: 'Alice' };
      const updated = { id: '1', fullName: 'Alice Updated' };

      prisma.candidate.findFirst.mockResolvedValue(existing);
      prisma.candidate.update.mockResolvedValue(updated);

      const result = await service.update('1', { fullName: 'Alice Updated' });
      expect(result.fullName).toBe('Alice Updated');
      expect(prisma.candidate.findFirst).toHaveBeenCalledWith({
        where: { id: '1', workspaceId: WORKSPACE_ID },
      });
    });

    it('should throw NotFoundException when candidate is from another workspace', async () => {
      prisma.candidate.findFirst.mockResolvedValue(null);

      await expect(
        service.update('not-exist', { fullName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove - workspace isolation', () => {
    it('should delete candidate within the current workspace', async () => {
      prisma.candidate.findFirst.mockResolvedValue({ id: '1' });
      prisma.candidate.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');
      expect(prisma.candidate.findFirst).toHaveBeenCalledWith({
        where: { id: '1', workspaceId: WORKSPACE_ID },
      });
      expect(prisma.candidate.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when candidate is from another workspace', async () => {
      prisma.candidate.findFirst.mockResolvedValue(null);

      await expect(service.remove('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
