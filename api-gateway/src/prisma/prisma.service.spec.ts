import { PrismaService } from './prisma.service';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {
      $connect = jest.fn().mockResolvedValue(undefined);
      $disconnect = jest.fn().mockResolvedValue(undefined);
    },
  };
});

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should connect to database', async () => {
      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database', async () => {
      await service.onModuleDestroy();

      expect(service.$disconnect).toHaveBeenCalled();
    });
  });
});
