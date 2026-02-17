import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('test-value'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: {
    set: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    exists: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
    ttl: jest.Mock;
    ping: jest.Mock;
    quit: jest.Mock;
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService(mockConfigService as unknown as ConfigService);
    mockRedisClient = service.getClient() as unknown as typeof mockRedisClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error if REDIS_URL is not defined', () => {
    const emptyConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(() => {
      new RedisService(emptyConfigService as unknown as ConfigService);
    }).toThrow('REDIS_URL is not defined in the configuration');
  });

  describe('set', () => {
    it('should set a value without TTL', async () => {
      const result = await service.set('key', 'value');

      expect(result).toBe('OK');
      expect(mockRedisClient.set).toHaveBeenCalledWith('key', 'value');
    });

    it('should set a value with TTL', async () => {
      const result = await service.set('key', 'value', 3600);

      expect(result).toBe('OK');
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'key',
        'value',
        'EX',
        3600,
      );
    });
  });

  describe('get', () => {
    it('should get a value', async () => {
      const result = await service.get('key');

      expect(result).toBe('test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('key');
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await service.get('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      const result = await service.del('key');

      expect(result).toBe(1);
      expect(mockRedisClient.del).toHaveBeenCalledWith('key');
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      const result = await service.exists('key');

      expect(result).toBe(1);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('key');
    });

    it('should return 0 for non-existent key', async () => {
      mockRedisClient.exists.mockResolvedValueOnce(0);

      const result = await service.exists('non-existent');

      expect(result).toBe(0);
    });
  });

  describe('ping', () => {
    it('should return PONG', async () => {
      const result = await service.ping();

      expect(result).toBe('PONG');
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit redis connection', async () => {
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('getClient', () => {
    it('should return redis client', () => {
      const client = service.getClient();

      expect(client).toBeDefined();
    });
  });

  describe('incr', () => {
    it('should increment a key', async () => {
      const result = await service.incr('counter');

      expect(result).toBe(1);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('counter');
    });

    it('should return incremented value', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(5);

      const result = await service.incr('counter');

      expect(result).toBe(5);
    });
  });

  describe('expire', () => {
    it('should set expiration on key', async () => {
      const result = await service.expire('key', 3600);

      expect(result).toBe(1);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('key', 3600);
    });

    it('should return 0 if key does not exist', async () => {
      mockRedisClient.expire.mockResolvedValueOnce(0);

      const result = await service.expire('non-existent', 3600);

      expect(result).toBe(0);
    });
  });

  describe('ttl', () => {
    it('should return TTL of key', async () => {
      const result = await service.ttl('key');

      expect(result).toBe(3600);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('key');
    });

    it('should return -1 if key has no expiration', async () => {
      mockRedisClient.ttl.mockResolvedValueOnce(-1);

      const result = await service.ttl('key-no-expire');

      expect(result).toBe(-1);
    });

    it('should return -2 if key does not exist', async () => {
      mockRedisClient.ttl.mockResolvedValueOnce(-2);

      const result = await service.ttl('non-existent');

      expect(result).toBe(-2);
    });
  });
});
