import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import path from 'node:path';
import { contact } from './control.mjs';
import { fingerprint, publicStatus, readJson } from './storage.mjs';

export async function startBackground(project, files, plan, executable, sourceTurnId) {
  const previous = readJson(files.state, true);
  if (previous && previous.planHash !== fingerprint(plan)) throw new Error('计划已修改，请先归档旧进度再开始。');
  if (previous?.phase === 'complete' || await contact(files)) {
    return publicStatus(previous, files, await contact(files));
  }
  mkdirSync(files.dir, { recursive: true });
  const launchId = randomUUID();
  const output = path.join(files.dir, 'worker.log');
  const fd = openSync(output, 'a');
  try {
    const child = spawn(process.execPath, [
      fileURLToPath(new URL('./cli.mjs', import.meta.url)), '_worker', project,
      fingerprint(plan), executable, JSON.stringify({ sourceTurnId, launchId })
    ], { cwd: project, detached: true, windowsHide: true, stdio: ['ignore', fd, fd] });
    await once(child, 'spawn');
    child.unref();
  } finally {
    closeSync(fd);
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const state = readJson(files.state, true);
    if (state?.launchId === launchId || await contact(files)) {
      return { ...publicStatus(state, files, await contact(files)), workerLog: output };
    }
    await pause(100);
  }
  throw new Error(`后台启动尚未确认，请查询状态并查看 ${output}`);
}
