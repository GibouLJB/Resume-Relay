import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const planName = 'codex-resume.plan.json';

export function projectPath(input) {
  const project = realpathSync.native(path.resolve(input));
  if (!statSync(project).isDirectory()) throw new Error('请选择项目文件夹。');
  return project;
}

export function projectKey(project) {
  return process.platform === 'win32' ? project.toLowerCase() : project;
}

export function locations(project) {
  const key = createHash('sha256').update(projectKey(project)).digest('hex').slice(0, 32);
  const root = process.env.LOCALAPPDATA || path.join(homedir(), '.local', 'state');
  const dir = path.join(root, 'CodexResume', key);
  return {
    dir,
    pipe: process.platform === 'win32' ? '\\\\.\\pipe\\codex-resume-' + key : path.join(dir, 'worker.sock'),
    state: path.join(dir, 'state.json'),
    log: path.join(dir, 'progress.jsonl')
  };
}

export function readJson(file, optional = false) {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw new Error(`无法读取 ${file}：${error.message}`, { cause: error });
  }
}

export function readPlan(project) {
  const plan = readJson(path.join(project, planName));
  const { version, threadId, tasks, test, maxAttempts = 4, turnTimeoutMinutes = 90, testTimeoutMinutes = 20 } = plan;
  const validText = (value, length) => typeof value === 'string' && value.trim() && value.length <= length;
  const inRange = (value, max) => Number.isInteger(value) && value >= 1 && value <= max;
  if (
    version !== 1 || typeof threadId !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(threadId) ||
    !Array.isArray(tasks) || !inRange(tasks.length, 200) ||
    tasks.some(task => !task || !validText(task.id, 80) || !validText(task.title, 200) || !validText(task.acceptance, 8000)) ||
    new Set(tasks.map(task => task.id)).size !== tasks.length ||
    !Array.isArray(test) || !inRange(test.length, 100) ||
    test.some(arg => typeof arg !== 'string' || arg.includes('\0') || arg.length > 8000) || !test[0].trim() ||
    !inRange(maxAttempts, 20) || !inRange(turnTimeoutMinutes, 360) || !inRange(testTimeoutMinutes, 120)
  ) throw new Error('任务清单无效。请参考发行包内的示例和字段限制。');
  return {
    version, threadId, tasks: tasks.map(({ id, title, acceptance }) => ({ id, title, acceptance })),
    test, maxAttempts, turnTimeoutMinutes, testTimeoutMinutes
  };
}

export function fingerprint(plan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

export function writeJson(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { flush: true, flag: 'wx' });
    renameSync(temp, file);
  } finally {
    rmSync(temp, { force: true });
  }
}

export function journal(files, event, data = {}) {
  mkdirSync(files.dir, { recursive: true });
  appendFileSync(files.log, JSON.stringify({ time: new Date().toISOString(), event, ...data }) + '\n');
}

export function publicStatus(state, files, running) {
  if (!state) return { phase: 'notStarted' };
  const { project, threadId, index, total, task, phase, note, updatedAt, waitUntil } = state;
  return {
    project, threadId, verified: index, total, task,
    phase: !running && ['queued', 'handoff', 'developing', 'testing', 'waiting'].includes(phase) ? 'interrupted' : phase,
    running, note, updatedAt, nextCheck: waitUntil ? new Date(waitUntil).toISOString() : null, log: files.log
  };
}
