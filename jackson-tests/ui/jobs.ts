import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { ROOT } from './root.ts';

export type JobState = {
  name: string;
  running: boolean;
  log: string;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export const job: JobState = {
  name: '',
  running: false,
  log: '',
  exitCode: null,
  startedAt: null,
  finishedAt: null,
};

let child: ChildProcessWithoutNullStreams | null = null;

function appendLog(chunk: Buffer | string) {
  job.log += chunk.toString();
  if (job.log.length > 80_000) job.log = job.log.slice(-80_000);
}

export function startProcess(command: string, args: string[], name: string) {
  if (job.running) throw new Error('A job is already running');
  job.name = name;
  job.running = true;
  job.log = `$ ${command} ${args.join(' ')}\n`;
  job.exitCode = null;
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;

  child = spawn(command, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      ...(name === 'script1' || name === 'script2' ? { SKIP_OPEN_UI: '1' } : {}),
    },
    shell: false,
  });
  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);
  child.on('close', (code) => {
    job.running = false;
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
    appendLog(`\n[exit ${code}]\n`);
    child = null;
  });
  child.on('error', (err) => {
    job.running = false;
    job.exitCode = 1;
    job.finishedAt = new Date().toISOString();
    appendLog(`\n${err.message}\n`);
    child = null;
  });
}

export function startNpm(name: string, args: string[]) {
  startProcess('npm', args, name);
}

export function startBin(command: string, name: string, args: string[]) {
  startProcess(command, args, name);
}
