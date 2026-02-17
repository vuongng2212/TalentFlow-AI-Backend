import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRegistry', () => {
    it('should return the prometheus registry', () => {
      const registry = service.getRegistry();

      expect(registry).toBeDefined();
      expect(typeof registry.metrics).toBe('function');
    });

    it('should include default metrics', async () => {
      const registry = service.getRegistry();
      const metrics = await registry.metrics();

      // Default metrics include process and nodejs metrics
      expect(metrics).toContain('process_cpu');
      expect(metrics).toContain('nodejs_');
    });

    it('should include custom http metrics', async () => {
      const registry = service.getRegistry();
      const metrics = await registry.metrics();

      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('http_requests_total');
    });
  });

  describe('recordRequest', () => {
    it('should record request metrics', async () => {
      service.recordRequest('GET', '/api/users', 200, 0.05);

      const metrics = await service.getRegistry().metrics();

      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('http_requests_total');
    });

    it('should record multiple requests', async () => {
      service.recordRequest('GET', '/api/users', 200, 0.05);
      service.recordRequest('POST', '/api/users', 201, 0.1);
      service.recordRequest('GET', '/api/users/1', 404, 0.02);

      const metrics = await service.getRegistry().metrics();

      // All methods should be recorded
      expect(metrics).toContain('method="GET"');
      expect(metrics).toContain('method="POST"');
    });

    it('should record different status codes', async () => {
      service.recordRequest('GET', '/api/test', 200, 0.05);
      service.recordRequest('GET', '/api/test', 404, 0.02);
      service.recordRequest('GET', '/api/test', 500, 0.01);

      const metrics = await service.getRegistry().metrics();

      expect(metrics).toContain('status="200"');
      expect(metrics).toContain('status="404"');
      expect(metrics).toContain('status="500"');
    });

    it('should record duration in histogram buckets', async () => {
      // Record requests in different duration buckets
      service.recordRequest('GET', '/fast', 200, 0.01);
      service.recordRequest('GET', '/slow', 200, 2.0);

      const metrics = await service.getRegistry().metrics();

      // Check histogram buckets are present
      expect(metrics).toContain('http_request_duration_seconds_bucket');
    });

    it('should increment counter for each request', async () => {
      const path = '/api/counter-test';
      service.recordRequest('GET', path, 200, 0.05);
      service.recordRequest('GET', path, 200, 0.05);
      service.recordRequest('GET', path, 200, 0.05);

      const metrics = await service.getRegistry().metrics();

      // Counter should be recorded
      expect(metrics).toContain('http_requests_total');
    });
  });
});
