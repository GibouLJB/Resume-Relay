import { createInterface } from 'node:readline';
import path from 'node:path';
import { contact } from './control.mjs';
import { locations, projectPath, publicStatus, readJson, readPlan, projectKey } from './storage.mjs';
import { executable } from './executable.mjs';
import { AppServer } from './app-server.mjs';
import { startBackground } from './background.mjs';

const statusTool = {
  name: 'resume_status',
  description: '查看指定 Windows 项目的 Codex 续跑进度、额度等待时间和退出原因。',
  inputSchema: {
    type: 'object',
    properties: { project: { type: 'string', description: '项目文件夹绝对路径' } },
    required: ['project'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
};

const startTool = { ...statusTool, name: 'resume_start',
  description: '启动或恢复项目清单，等待原会话轮次结束后接管。用户要求自动续跑时使用。',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true } };
const stopTool = { ...statusTool, name: 'resume_stop',
  description: '停止项目后台续跑，包括等待会话交接或额度的进程。',
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } };
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  let request;
  try { request = JSON.parse(line); } catch { request = null; }
  if (!request) {
    send({ id: null, error: { code: -32700, message: 'Parse error' } });
    continue;
  }
  if (request.id == null) continue;
  const { id, method, params } = request;
  switch (method) {
    case 'initialize': {
      const versions = ['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'];
      send({ id, result: {
        protocolVersion: versions.includes(params?.protocolVersion) ? params.protocolVersion : versions.at(-1),
        capabilities: { tools: {} },
        serverInfo: { name: 'codex-resume', version: '0.2.0' }
      } });
      break;
    }
    case 'ping':
      send({ id, result: {} });
      break;
    case 'tools/list':
      send({ id, result: { tools: [statusTool, startTool, stopTool] } });
      break;
    case 'tools/call':
      try {
        if (![statusTool.name, startTool.name, stopTool.name].includes(params?.name)) throw new Error('未知工具。');
        const input = params.arguments?.project;
        if (typeof input !== 'string' || !path.isAbsolute(input)) throw new Error('请提供项目文件夹绝对路径。');
        const project = projectPath(input);
        const files = locations(project);
        if (params.name === startTool.name) {
          const plan = readPlan(project);
          if (await contact(files)) {
            const status = publicStatus(readJson(files.state, true), files, true);
            send({ id, result: { content: [{ type: 'text', text: JSON.stringify(status) }] } });
            break;
          }
          const codex = executable();
          const api = new AppServer(codex, project);
          let sourceTurnId;
          try {
            await api.initialize();
            const { thread } = await api.request('thread/read', { threadId: plan.threadId });
            if (!thread || thread.ephemeral || projectKey(projectPath(thread.cwd)) !== projectKey(project)) {
              throw new Error('计划中的会话必须属于此本地项目。');
            }
            const turns = await api.request('thread/turns/list', { threadId: plan.threadId, limit: 1, sortDirection: 'desc' });
            if (!turns.data?.[0]?.id) throw new Error('无法获取原会话当前轮次。请确认本地会话已有消息。');
            sourceTurnId = turns.data[0].id;
          } finally { await api.close(); }
          const status = await startBackground(project, files, plan, codex, sourceTurnId);
          send({ id, result: { content: [{ type: 'text', text: JSON.stringify(status) }] } });
          break;
        }
        if (params.name === stopTool.name) {
          const state = readJson(files.state, true);
          const requested = state?.token ? await contact(files, `stop ${state.token}`) : false;
          send({ id, result: { content: [{ type: 'text', text: JSON.stringify({ stopRequested: requested, ...publicStatus(state, files, await contact(files)) }) }] } });
          break;
        }
        const status = publicStatus(readJson(files.state, true), files, await contact(files));
        send({ id, result: { content: [{ type: 'text', text: JSON.stringify(status) }] } });
      } catch (error) {
        send({ id, result: { isError: true, content: [{ type: 'text', text: error.message }] } });
      }
      break;
    default:
      send({ id, error: { code: -32601, message: 'Method not found' } });
  }
}

function send(message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
}
