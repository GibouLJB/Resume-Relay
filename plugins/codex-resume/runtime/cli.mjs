import { executable } from './executable.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { closeSync, existsSync, mkdirSync, openSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { AppServer } from './app-server.mjs';
import { contact, lockProject } from './control.mjs';
import { fingerprint, locations, planName, projectPath, publicStatus, readJson, readPlan } from './storage.mjs';
import { runProject } from './worker.mjs';

const menu = [
  ['init', '创建任务清单'],
  ['threads', '查看项目会话'],
  ['background', '在后台启动或恢复续跑'],
  ['status', '查看进度'],
  ['stop', '停止续跑'],
  ['archive', '归档旧进度'],
  ['doctor', '检查账号与额度接口'],
  ['install', '注册桌面插件来源'],
  ['run', '在当前窗口启动续跑']
];


async function withServer(project, action) {
  const api = new AppServer(executable(), project);
  try {
    await api.initialize();
    return await action(api);
  } finally {
    await api.close();
  }
}

const clean = value => String(value ?? '').replace(/[\x00-\x1F\x7F]/g, ' ');

async function listThreads(project) {
  const result = await withServer(project, api => api.request('thread/list', {
    currentAccountOnly: true, cwd: project, limit: 20, sortKey: 'updated_at'
  }));
  if (!Array.isArray(result?.data)) throw new Error('Codex 未返回会话清单。');
  if (!result.data.length) console.log('未找到会话。请在该文件夹的 Codex 本地会话中先发送一条消息。');
  result.data.forEach((thread, index) => {
    console.log(`${index + 1}. ${clean(thread.name || thread.preview).slice(0, 75)}  ${thread.id}`);
  });
  return result.data;
}

async function confirm(rl, label) {
  if ((await rl.question(`${label}（输入 YES 确认） `)).trim() !== 'YES') {
    throw new Error('操作已取消。');
  }
}

async function action(command, project, rl) {
  if (command === 'install') {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    if (!existsSync(path.join(root, '.agents', 'plugins', 'marketplace.json'))) {
      throw new Error('请从完整的发行包运行安装命令。');
    }
    const result = spawnSync(executable(), ['plugin', 'marketplace', 'add', root], { stdio: 'inherit', windowsHide: true });
    if (result.status !== 0) throw new Error('注册插件来源失败。请检查 Codex CLI 输出。');
    console.log('重启 Codex，打开插件目录，选择 Resume Relay，安装「续程 · Codex 项目续跑」。');
    return;
  }
  const files = locations(project);
  switch (command) {
    case 'threads':
      await listThreads(project);
      break;
    case 'init': {
      const file = path.join(project, planName);
      if (existsSync(file)) throw new Error(`清单已存在，可用记事本打开：${file}`);
      const threads = await listThreads(project);
      const choice = (await rl.question('输入会话序号，或粘贴会话 UUID： ')).trim();
      const id = threads[Number(choice) - 1]?.id ?? choice;
      if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id)) throw new Error('会话 ID 无效。');
      const plan = {
        version: 1, threadId: id,
        tasks: [{ id: 'first-task', title: '', acceptance: '' }],
        test: [], maxAttempts: 4, turnTimeoutMinutes: 90, testTimeoutMinutes: 20
      };
      writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
      console.log(`已创建空白清单。填写任务标题、验收要求和测试命令后再启动：${file}`);
      break;
    }
    case 'doctor':
      await withServer(project, async api => {
        const { account } = await api.request('account/read', { refreshToken: false });
        if (!['chatgpt', 'chatgptAuthTokens'].includes(account?.type)) {
          throw new Error('此工具需要可由本地 Codex CLI 读取的 ChatGPT 登录。');
        }
        const limits = await api.request('account/rateLimits/read');
        const bucket = limits.rateLimitsByLimitId?.codex ?? limits.rateLimits;
        if (!bucket) throw new Error('未返回有效的 Codex 额度信息。');
        for (const [name, window] of [['主窗口', bucket.primary], ['次窗口', bucket.secondary]]) {
          if (window) console.log(`${name}已用 ${window.usedPercent}%，重置 ${window.resetsAt ? new Date(window.resetsAt * 1000).toLocaleString() : '未知'}。`);
        }
        console.log('ChatGPT 登录和额度查询正常。');
      });
      break;
    case 'status': {
      const state = readJson(files.state, true);
      console.log(JSON.stringify(publicStatus(state, files, await contact(files)), null, 2));
      break;
    }
    case 'stop': {
      const state = readJson(files.state, true);
      if (!state?.token || !await contact(files, `stop ${state.token}`)) throw new Error('没有找到正在运行的项目。');
      console.log('停止请求已发送。可用「查看进度」确认续跑器退出。');
      break;
    }
    case 'archive': {
      await confirm(rl, '归档后，下次启动将从清单第一项执行');
      mkdirSync(files.dir, { recursive: true });
      const release = await lockProject(files, () => false);
      try {
        const folder = path.join(files.dir, 'archive', randomUUID());
        mkdirSync(folder, { recursive: true });
        for (const file of [files.log, files.state]) {
          if (existsSync(file)) renameSync(file, path.join(folder, path.basename(file)));
        }
        console.log(`归档位置：${folder}`);
      } finally {
        await release();
      }
      break;
    }
    case 'run':
    case 'background': {
      const plan = readPlan(project);
      console.log(JSON.stringify({ project, ...plan }, null, 2));
      await confirm(rl, '允许 Codex 在此项目内开发并反复运行以上测试命令');
      rl.close();
      const codex = executable();
      if (command === 'run') {
        await runProject(project, files, plan, codex);
        break;
      }
      if (await contact(files)) throw new Error('该项目已有续跑进程。');
      mkdirSync(files.dir, { recursive: true });
      const output = path.join(files.dir, 'worker.log');
      const fd = openSync(output, 'a');
      try {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '_worker', project, fingerprint(plan), codex], {
          cwd: project, detached: true, windowsHide: true, stdio: ['ignore', fd, fd]
        });
        await once(child, 'spawn');
        child.unref();
      } finally {
        closeSync(fd);
      }
      console.log(`已提交后台启动请求。通过「查看进度」检查运行状态。启动日志：${output}`);
      break;
    }
    default:
      throw new Error('未知命令。');
  }
}

async function main() {
  if (process.platform !== 'win32') throw new Error('续跑启动器面向 Windows。');
  if (+process.versions.node.split('.')[0] < 22) throw new Error('请安装 Node.js 22 或更新版本。');
  if (process.argv[2] === '_worker') {
    const [, , , input, expectedHash, codex] = process.argv;
    const project = projectPath(input);
    const plan = readPlan(project);
    if (fingerprint(plan) !== expectedHash) throw new Error('清单在后台启动前发生变化，请重新审核。');
    await runProject(project, locations(project), plan, codex, undefined, process.argv[6] ? JSON.parse(process.argv[6]) : {});
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let [command, input] = process.argv.slice(2);
    if (!command) {
      console.log('续程 · Resume Relay 0.2.0');
      menu.forEach(([, label], index) => console.log(`${index + 1}. ${label}`));
      const choice = await rl.question('请选择： ');
      command = menu[Number(choice) - 1]?.[0];
    }
    if (!menu.some(([name]) => name === command)) throw new Error('未知命令。');
    if (command !== 'install' && !input) input = await rl.question('项目文件夹（可拖入路径，留空使用当前目录）： ');
    const project = command === 'install' ? null : projectPath(input.trim().replace(/^"(.*)"$/, '$1') || process.cwd());
    await action(command, project, rl);
  } finally {
    rl.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(clean(error.message));
  process.exitCode = 1;
}
