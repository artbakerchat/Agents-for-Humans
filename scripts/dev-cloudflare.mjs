import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const processes = [
  spawn(npm, ['run', 'dev'], { stdio: 'inherit' }),
  spawn(npm, ['run', 'dev', '--', '--local', '--port', '8787'], {
    cwd: new URL('../backend/worker/', import.meta.url),
    stdio: 'inherit'
  })
];

let shuttingDown = false;
const stop = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) child.kill('SIGTERM');
  process.exitCode = code;
};

for (const child of processes) {
  child.on('exit', (code, signal) => {
    if (!shuttingDown) stop(code ?? (signal ? 1 : 0));
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
