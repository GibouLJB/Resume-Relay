import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createInterface } from 'node:readline';

export class RpcError extends Error {
  constructor(error) {
    super(error?.message || 'App Server 请求失败');
    this.code = error?.code;
    this.info = error?.data?.codexErrorInfo;
  }
}

export class AppServer extends EventEmitter {
  #next = 0;
  #pending = new Map();
  #failure;

  constructor(executable, cwd, args = ['app-server', '--listen', 'stdio://']) {
    super();
    this.child = spawn(executable, args, {
      cwd, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe']
    });
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Infinity });
    lines.on('line', line => this.#receive(line));
    this.child.stderr.resume();
    this.child.stdin.on('error', error => this.#fail(error));
    this.child.on('error', error => this.#fail(error));
    this.child.on('exit', (code, signal) => {
      this.#fail(new Error(`Codex App Server 已退出（${code ?? signal}）。`));
    });
  }

  #fail(error) {
    if (this.#failure) return;
    this.#failure = error;
    for (const pending of this.#pending.values()) pending.reject(error);
    this.emit('disconnect', error);
  }

  #receive(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.#fail(new Error('App Server 返回了无效的 JSON。请检查 Codex CLI 版本。'));
      return;
    }
    if (message.method && message.id != null) {
      this.emit('serverRequest', message.method);
      if (message.method.endsWith('/requestApproval')) {
        this.send({ id: message.id, result: { decision: 'cancel' } });
      } else {
        this.send({ id: message.id, error: { code: -32601, message: 'Unattended runner cannot answer interactive requests' } });
      }
      return;
    }
    if (message.method) this.emit('notification', message.method, message.params);
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    if (message.error) pending.reject(new RpcError(message.error));
    else pending.resolve(message.result);
  }

  send(message) {
    this.child.stdin.write(JSON.stringify(message) + '\n');
  }

  request(method, params = {}, timeout = 30_000) {
    if (this.#failure) return Promise.reject(this.#failure);
    const id = ++this.#next;
    let timer;
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`请求超时（${method}）。`)), timeout);
      this.#pending.set(id, { resolve, reject });
      this.send({ id, method, params });
    }).finally(() => {
      clearTimeout(timer);
      this.#pending.delete(id);
    });
  }

  async initialize() {
    await this.request('initialize', {
      clientInfo: { name: 'codex_resume', title: 'Codex Resume', version: '0.2.0' }
    });
    this.send({ method: 'initialized' });
  }

  async close() {
    if (this.child.exitCode !== null || this.child.signalCode !== null || !this.child.pid) return;
    const exited = once(this.child, 'exit');
    this.child.stdin.end();
    const timer = setTimeout(() => this.child.kill(), 3000);
    try {
      await exited;
    } finally {
      clearTimeout(timer);
    }
  }
}
