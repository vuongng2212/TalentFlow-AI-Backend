import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { getProcessStats, getDockerStats } from './system_stats.mjs';

function runAutocannon(args) {
  const cmd = `npx autocannon --json ${args}`;
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(stdout);
    return {
      requests: {
        average: parsed.requests.average,
        total: parsed.requests.total,
        p50: parsed.requests.p50,
        p99: parsed.requests.p99
      },
      latency: {
        average: parsed.latency.average,
        p50: parsed.latency.p50,
        p95: parsed.latency.p90,
        p97_5: parsed.latency.p97_5,
        p99: parsed.latency.p99,
        max: parsed.latency.max
      },
      throughput: {
        average: parsed.throughput.average,
        total: parsed.throughput.total
      },
      errors: parsed.errors,
      timeouts: parsed.timeouts,
      non2xx: parsed.non2xx,
      duration: parsed.duration
    };
  } catch (err) {
    return { error: err.message };
  }
}

function getAuthToken() {
  const out = execSync(
    'curl -s -X POST http://localhost:8080/api/v1/auth/login ' +
    '-H "Content-Type: application/json" ' +
    '-d \'{"email":"seed-admin@talentflow.invalid","password":"Password123!"}\' -c -',
    { encoding: 'utf-8' }
  );
  const match = out.match(/access_token\s+([^\s]+)/);
  if (!match) {
    throw new Error('Failed to extract access_token from login');
  }
  return match[1];
}

async function main() {
  const initialSystem = { processes: getProcessStats(), docker: getDockerStats() };
  const results = {
    metadata: {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    },
    initialSystem,
    apiGateway: {},
    notificationService: {},
    cvParserService: {},
    postgres: {},
    redis: {},
    rabbitmq: {},
    finalSystem: {}
  };

  const token = getAuthToken();

  results.apiGateway.health_c10 = runAutocannon('-c 10 -d 5 http://localhost:8080/health');
  results.apiGateway.health_c50 = runAutocannon('-c 50 -d 5 http://localhost:8080/health');
  results.apiGateway.health_c100 = runAutocannon('-c 100 -d 5 http://localhost:8080/health');

  results.apiGateway.ready_c10 = runAutocannon('-c 10 -d 5 http://localhost:8080/ready');
  results.apiGateway.ready_c50 = runAutocannon('-c 50 -d 5 http://localhost:8080/ready');

  results.apiGateway.metrics_c10 = runAutocannon('-c 10 -d 3 http://localhost:8080/metrics');

  results.apiGateway.login_c1 = runAutocannon(
    '-c 1 -d 5 -m POST -H "Content-Type: application/json" ' +
    '-b \'{"email":"seed-admin@talentflow.invalid","password":"Password123!"}\' ' +
    'http://localhost:8080/api/v1/auth/login'
  );
  results.apiGateway.login_c10 = runAutocannon(
    '-c 10 -d 5 -m POST -H "Content-Type: application/json" ' +
    '-b \'{"email":"seed-admin@talentflow.invalid","password":"Password123!"}\' ' +
    'http://localhost:8080/api/v1/auth/login'
  );
  results.apiGateway.login_c25 = runAutocannon(
    '-c 25 -d 5 -m POST -H "Content-Type: application/json" ' +
    '-b \'{"email":"seed-admin@talentflow.invalid","password":"Password123!"}\' ' +
    'http://localhost:8080/api/v1/auth/login'
  );
  results.apiGateway.login_c50 = runAutocannon(
    '-c 50 -d 5 -m POST -H "Content-Type: application/json" ' +
    '-b \'{"email":"seed-admin@talentflow.invalid","password":"Password123!"}\' ' +
    'http://localhost:8080/api/v1/auth/login'
  );

  results.apiGateway.jobs_c10 = runAutocannon(
    `-c 10 -d 5 -H "Cookie: access_token=${token}" http://localhost:8080/api/v1/jobs`
  );
  results.apiGateway.jobs_c50 = runAutocannon(
    `-c 50 -d 5 -H "Cookie: access_token=${token}" http://localhost:8080/api/v1/jobs`
  );
  results.apiGateway.jobs_c100 = runAutocannon(
    `-c 100 -d 5 -H "Cookie: access_token=${token}" http://localhost:8080/api/v1/jobs`
  );

  results.apiGateway.applications_c10 = runAutocannon(
    `-c 10 -d 5 -H "Cookie: access_token=${token}" http://localhost:8080/api/v1/applications`
  );
  results.apiGateway.applications_c50 = runAutocannon(
    `-c 50 -d 5 -H "Cookie: access_token=${token}" http://localhost:8080/api/v1/applications`
  );

  results.notificationService.root_c10 = runAutocannon('-c 10 -d 5 http://localhost:5000/');
  results.notificationService.root_c50 = runAutocannon('-c 50 -d 5 http://localhost:5000/');

  results.cvParserService.actuator_health_c10 = runAutocannon('-c 10 -d 5 http://localhost:8081/actuator/health');
  results.cvParserService.actuator_prometheus_c10 = runAutocannon('-c 10 -d 3 http://localhost:8081/actuator/prometheus');

  results.postgres = runPostgresBenchmarks();
  results.redis = runRedisBenchmarks();
  results.rabbitmq = runRabbitMqBenchmarks();
  results.pipeline = runCvPipelineBenchmark();

  results.finalSystem = { processes: getProcessStats(), docker: getDockerStats() };

  writeFileSync('benchmarks/results.json', JSON.stringify(results, null, 2));
  console.log('Benchmark finished. Output written to benchmarks/results.json');
}

function runPostgresBenchmarks() {
  const pgResults = {};
  const queries = {
    pkLookup: "SELECT id, email, full_name, role FROM users WHERE id = '3bc3caa0-6109-4e66-8693-b6d564ab132a';",
    indexedFilter: "SELECT id, title, department, status FROM jobs WHERE workspace_id = '0c1be551-4c99-4d1a-8752-14a7f6387b1a' AND status = 'OPEN';",
    relationJoin: "SELECT j.id, j.title, count(a.id) as app_count FROM jobs j LEFT JOIN applications a ON j.id = a.job_id GROUP BY j.id, j.title;"
  };

  for (const [qName, sql] of Object.entries(queries)) {
    writeFileSync('/tmp/bench_query.sql', sql);
    pgResults[qName] = {};
    for (const clients of [1, 10, 25, 50]) {
      try {
        const out = execSync(
          `PGPASSWORD=1111 pgbench -U postgres -h localhost -d talentflow_dev -c ${clients} -j 2 -T 3 -f /tmp/bench_query.sql`,
          { encoding: 'utf-8' }
        );
        const tpsMatch = out.match(/tps = ([0-9.]+)/);
        const latencyMatch = out.match(/latency average = ([0-9.]+) ms/);
        pgResults[qName][`c${clients}`] = {
          tps: tpsMatch ? parseFloat(tpsMatch[1]) : null,
          latencyAvgMs: latencyMatch ? parseFloat(latencyMatch[1]) : null
        };
      } catch (err) {
        pgResults[qName][`c${clients}`] = { error: err.message };
      }
    }
  }
  return pgResults;
}

function runRedisBenchmarks() {
  const redisResults = {};
  try {
    const raw = execSync(
      'docker exec talentflow-redis redis-benchmark -q -n 50000 -c 50 -t get,set,ping,lpush,lpop',
      { encoding: 'utf-8' }
    );
    for (const line of raw.split(/[\r\n]+/)) {
      const match = line.match(/^\s*([A-Z_]+):\s+([0-9.]+)\s+requests per second,\s+p50=([0-9.]+)\s+msec/);
      if (match) {
        redisResults[match[1].trim()] = {
          rps: parseFloat(match[2]),
          p50Ms: parseFloat(match[3])
        };
      }
    }
  } catch (err) {
    redisResults.error = err.message;
  }
  return redisResults;
}

function runRabbitMqBenchmarks() {
  try {
    const out = execSync('node benchmarks/rabbitmq_bench.mjs', { encoding: 'utf-8' });
    return JSON.parse(out);
  } catch (err) {
    return { error: err.message };
  }
}

function runCvPipelineBenchmark() {
  const e2eTimes = [];
  const jobId = '236d758a-068a-43e6-8e0f-1bc254871805';

  for (let i = 0; i < 3; i++) {
    const token = getAuthToken();
    try {
      execSync(
        `PGPASSWORD=1111 psql -U postgres -d talentflow_dev -h localhost -c ` +
        `"DELETE FROM cv_parser.cv_parse_results WHERE candidate_id = 'bfe26cf6-acb4-4061-aa14-f4b556e3aeb2' AND job_id = '${jobId}'; ` +
        `DELETE FROM public.applications WHERE candidate_id = 'bfe26cf6-acb4-4061-aa14-f4b556e3aeb2' AND job_id = '${jobId}';"`,
        { encoding: 'utf-8' }
      );
    } catch {}

    const t0 = performance.now();
    try {
      const uploadOut = execSync(
        `curl -s -H "Cookie: access_token=${token}" -X POST http://localhost:8080/api/v1/applications/upload ` +
        `-F "jobId=${jobId}" -F "file=@/tmp/test_cv.pdf"`,
        { encoding: 'utf-8' }
      );
      const parsed = JSON.parse(uploadOut);
      const appId = parsed?.data?.applicationId;
      if (!appId) {
        e2eTimes.push({ error: 'upload returned no applicationId', raw: uploadOut });
        continue;
      }

      let processed = false;
      let attempts = 0;
      while (!processed && attempts < 40) {
        execSync('sleep 0.1');
        const dbCheck = execSync(
          `PGPASSWORD=1111 psql -U postgres -d talentflow_dev -h localhost -t -c ` +
          `"SELECT status FROM cv_parser.cv_parse_results WHERE application_id = '${appId}';"`,
          { encoding: 'utf-8' }
        ).trim();
        if (dbCheck === 'SUCCESS' || dbCheck === 'PARTIAL') {
          processed = true;
        }
        attempts++;
      }
      const t1 = performance.now();
      e2eTimes.push({
        applicationId: appId,
        durationMs: parseFloat((t1 - t0).toFixed(2)),
        success: processed
      });
    } catch (err) {
      e2eTimes.push({ error: err.message });
    }
  }

  return {
    runs: e2eTimes,
    averageDurationMs: (
      e2eTimes.reduce((acc, r) => acc + (parseFloat(r.durationMs) || 0), 0) / (e2eTimes.length || 1)
    ).toFixed(2)
  };
}

main().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
