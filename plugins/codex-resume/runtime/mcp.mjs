import { createInterface } from 'node:readline';
import path from 'node:path';
import { contact } from './control.mjs';
import { locations, projectPath, publicStatus, readJson } from './storage.mjs';

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
        serverInfo: { name: 'codex-resume', version: '0.1.0' }
      } });
      break;
    }
    case 'ping':
      send({ id, result: {} });
      break;
    case 'tools/list':
      send({ id, result: { tools: [statusTool] } });
      break;
    case 'tools/call':
      try {
        if (params?.name !== statusTool.name) throw new Error('未知工具。');
        const input = params.arguments?.project;
        if (typeof input !== 'string' || !path.isAbsolute(input)) throw new Error('请提供项目文件夹绝对路径。');
        const files = locations(projectPath(input));
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
