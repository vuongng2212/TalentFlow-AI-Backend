import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CandidatesService } from './candidates.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  candidate: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CandidatesService', () => {
  let service: CandidatesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidatesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CandidatesService>(CandidatesService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated candidates', async () => {
      const mockCandidates = [
        {
          id: '1',
          fullName: 'Alice',
          email: 'alice@test.com',
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
    });

    it('should apply search filter', async () => {
      prisma.candidate.findMany.mockResolvedValue([]);
      prisma.candidate.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, search: 'alice' });

      expect(prisma.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { fullName: { contains: 'alice', mode: 'insensitive' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return candidate with applications', async () => {
      const mockCandidate = { id: '1', fullName: 'Alice', applications: [] };
      prisma.candidate.findUnique.mockResolvedValue(mockCandidate);

      const result = await service.findOne('1');
      expect(result).toEqual(mockCandidate);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update candidate fields', async () => {
      const existing = { id: '1', fullName: 'Alice' };
      const updated = { id: '1', fullName: 'Alice Updated' };

      prisma.candidate.findUnique.mockResolvedValue(existing);
      prisma.candidate.update.mockResolvedValue(updated);

      const result = await service.update('1', { fullName: 'Alice Updated' });
      expect(result.fullName).toBe('Alice Updated');
    });

    it('should throw NotFoundException when candidate not found', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);

      await expect(
        service.update('not-exist', { fullName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete candidate', async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: '1' });
      prisma.candidate.delete.mockResolvedValue({ id: '1' });

      await service.remove('1');
      expect(prisma.candidate.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException when candidate not found', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);

      await expect(service.remove('not-exist')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
