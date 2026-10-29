import { execSync } from 'child_process';

const PIDS = {
  apiGateway: 7565,
  notification: 7610,
  cvParser: 7923,
  postgres: 1085
};

export function getProcessStats() {
  const result = {};
  for (const [name, pid] of Object.entries(PIDS)) {
    try {
      const out = execSync(`ps -p ${pid} -o %cpu,%mem,rss,vsz --no-headers`, { encoding: 'utf-8' }).trim();
      const [cpu, mem, rss, vsz] = out.split(/\s+/).map(Number);
      result[name] = { pid, cpuPercent: cpu, memPercent: mem, rssKb: rss, vszKb: vsz, rssMb: (rss / 1024).toFixed(1) };
    } catch {
      result[name] = { pid, error: 'process not found' };
    }
  }
  return result;
}

export function getDockerStats() {
  try {
    const out = execSync('docker stats --no-stream --format "{{.Name}}:{{.CPUPerc}}:{{.MemUsage}}"', { encoding: 'utf-8' }).trim();
    const result = {};
    for (const line of out.split('\n')) {
      const [name, cpu, mem] = line.split(':');
      if (name) {
        result[name] = { cpu: cpu ? cpu.trim() : '0%', memory: mem ? mem.trim() : '0B' };
      }
    }
    return result;
  } catch {
    return {};
  }
}

if (process.argv[1]?.endsWith('system_stats.mjs')) {
  console.log(JSON.stringify({ processes: getProcessStats(), docker: getDockerStats() }, null, 2));
}
