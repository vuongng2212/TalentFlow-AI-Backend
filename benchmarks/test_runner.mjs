import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';

const out = execSync('npx autocannon -c 10 -d 2 --json http://localhost:8080/health', { encoding: 'utf-8' });
const data = JSON.parse(out);
console.log('RPS:', data.requests.average, 'p50:', data.latency.p50, 'p99:', data.latency.p99);
