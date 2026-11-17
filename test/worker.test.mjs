import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { setTimeout as pause } from 'node:timers/promises';
import { contact } from '../plugins/codex-resume/runtime/control.mjs';
import { locations, projectPath, readJson, readPlan, writeJson } from '../plugins/codex-resume/runtime/storage.mjs';
import { quotaDelay, runProject } from '../plugins/codex-resume/runtime/worker.mjs';

const threadId = '00000000-0000-4000-8000-000000000000';
const available = { rateLimits: { primary: { usedPercent: 18 } } };
const ready = { result: 'ready', summary: 'Implemented.' };

function fixture(t) {
  const temp = mkdtempSync(path.join(process.cwd(), '.codex-resume-test-'));
  const project = projectPath(temp);
  const files = { ...locations(project), dir: project, state: path.join(project, 'state.json'), log: path.join(project, 'log.jsonl') };
  if (process.platform !== 'win32') files.pipe = path.join(project, 'worker.sock');
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const plan = {
    version: 1, threadId, tasks: [
      { id: 'setup', title: 'setup', acceptance: 'validate setup' },
      { id: 'doc', title: 'documentation', acceptance: 'document setup' }
    ],
    test: ['cmd.exe', '/d', '/c', 'exit', '0'],
    maxAttempts: 4, turnTimeoutMinutes: 1, testTimeoutMinutes: 1
  };
  return { project, files, plan };
}

class FakeAppServer extends EventEmitter {
  constructor(project, { replies = [], exits = [], limits = [] } = {}) {
    super();
    this.replies = [...replies];
    this.exits = [...exits];
    this.limits = [...limits];
    this.project = project;
    this.calls = [];
  }

  async initialize() {}
  async close() {}

  async request(method, params) {
    this.calls.push({ method, params });
    switch (method) {
      case 'account/read':
        return { account: { type: 'chatgpt' }, userId: 'test-account' };
      case 'account/rateLimits/read':
        return this.limits.shift() ?? available;
      case 'thread/read':
      case 'thread/resume':
        assert.equal(params.threadId, threadId);
        return { thread: { id: threadId, cwd: this.project, status: { type: 'idle' } } };
      case 'turn/start': {
        const answer = this.replies.shift() ?? ready;
        const id = String(this.calls.length);
        const turn = { id, status: answer.error ? 'failed' : 'completed', error: answer.error };
        assert.equal(params.threadId, threadId);
        assert.equal(params.approvalPolicy, 'never');
        if (!answer.error) this.emit('notification', 'item/completed', {
          threadId, turnId: id, item: { type: 'agentMessage', text: JSON.stringify(answer) }
        });
        this.emit('notification', 'turn/completed', { threadId, turn });
        return { turn };
      }
      case 'command/exec': {
        assert.equal(params.sandboxPolicy.networkAccess, false);
        const exitCode = this.exits.shift() ?? 0;
        return { exitCode, stdout: '', stderr: exitCode ? 'failed regression' : '' };
      }
      default:
        throw new Error(`Unexpected method ${method}`);
    }
  }
}

test('quota delay follows both exhausted windows and handles unknown timestamps', () => {
  const now = 1_000_000_000;
  const windows = { rateLimits: {
    primary: { usedPercent: 100, resetsAt: (now + 120_000) / 1000 },
    secondary: { usedPercent: 100, resetsAt: (now + 600_000) / 1000 }
  } };
  assert.equal(quotaDelay(windows, now), 660_000);
  assert.equal(quotaDelay({ rateLimits: { primary: { usedPercent: 100 } } }, now), 900_000);
  assert.equal(quotaDelay(available, now), 0);
  assert.throws(() => quotaDelay({ rateLimits: { rateLimitReachedType: 'workspace_member_credits_depleted' } }, now));
});

test('a failed test feeds diagnostics into the same task and only passing tasks advance', async t => {
  const { project, files, plan } = fixture(t);
  const api = new FakeAppServer(project, { exits: [1, 0, 0] });
  await runProject(project, files, plan, null, () => api);
  const turns = api.calls.filter(call => call.method === 'turn/start');
  assert.equal(turns.length, 3);
  assert.match(turns[1].params.input[0].text, /failed regression/);
  assert.match(turns[1].params.input[0].text, /validate setup/);
  assert.match(turns[2].params.input[0].text, /document setup/);
  assert.equal(readJson(files.state).phase, 'complete');
  assert.equal(readJson(files.state).index, 2);
  await runProject(project, files, plan, null, () => assert.fail('completed work must not open another connection'));
});

test('quota limit persists a wake time, excludes a second worker, and resumes the original thread', { timeout: 10000 }, async t => {
  const { project, files, plan } = fixture(t);
  const limited = { rateLimits: { primary: { usedPercent: 100, resetsAt: Math.ceil(Date.now() / 1000) + 1800 } } };
  const first = new FakeAppServer(project, {
    replies: [{ error: { codexErrorInfo: 'usageLimitExceeded' } }],
    limits: [available, limited]
  });
  const running = runProject(project, files, plan, null, () => first);
  running.catch(() => {});
  let state;
  for (let attempt = 0; attempt < 80; attempt++) {
    state = readJson(files.state, true);
    if (state?.phase === 'waiting') break;
    await pause(20);
  }
  try {
    assert.equal(state?.phase, 'waiting');
    assert.equal(state.index, 0);
    assert.equal(state.attempts, 0);
    assert.ok(state.waitUntil > Date.now());
    await assert.rejects(runProject(project, files, plan, null, () => assert.fail()), /已有续跑/);
  } finally {
    if (state?.token) assert.equal(await contact(files, `stop ${state.token}`), true);
    await running;
  }
  state = readJson(files.state);
  assert.equal(state.phase, 'stopped');
  writeJson(files.state, { ...state, waitUntil: Date.now() - 1 });
  const second = new FakeAppServer(project);
  await runProject(project, files, plan, null, () => second);
  assert.equal(second.calls.find(call => call.method === 'thread/resume').params.threadId, threadId);
  assert.equal(readJson(files.state).index, 2);
});

test('changed plan requires explicit archival and invalid test commands fail validation', async t => {
  const { project, files, plan } = fixture(t);
  await runProject(project, files, plan, null, () => new FakeAppServer(project));
  const changed = { ...plan, test: ['python', '-m', 'pytest'] };
  await assert.rejects(runProject(project, files, changed, null, () => assert.fail()), /已批准/);
  const planFile = path.join(project, 'codex-resume.plan.json');
  writeFileSync(planFile, '\uFEFF' + JSON.stringify(changed));
  assert.deepEqual(readPlan(project), changed);
  writeFileSync(planFile, JSON.stringify({ ...changed, test: [''] }));
  assert.throws(() => readPlan(project), /清单无效/);
});
