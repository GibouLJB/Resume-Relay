import { createConnection, createServer } from 'node:net';
import { once } from 'node:events';

export async function lockProject(files, onStop) {
  const server = createServer(socket => {
    socket.setEncoding('utf8');
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => socket.destroy());
    let input = '';
    socket.on('data', chunk => {
      input += chunk;
      if (input.length > 100) return socket.destroy();
      if (!input.endsWith('\n')) return;
      const [method, token] = input.trim().split(' ');
      const ok = method === 'ping' || (method === 'stop' && onStop(token));
      socket.end(ok ? 'ok\n' : 'denied\n');
    });
  });
  server.listen(files.pipe);
  try {
    await once(server, 'listening');
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw new Error('该项目已有续跑进程。');
    throw error;
  }
  return () => new Promise(resolve => server.close(resolve));
}

export function contact(files, request = 'ping') {
  return new Promise(resolve => {
    const socket = createConnection(files.pipe, () => socket.write(request + '\n'));
    socket.setEncoding('utf8');
    socket.setTimeout(1500, () => socket.destroy());
    let response = '';
    socket.on('data', data => {
      response += data;
      if (response.endsWith('\n') || response.length > 16) {
        resolve(response === 'ok\n');
        socket.destroy();
      }
    });
    socket.on('error', () => resolve(false));
    socket.on('close', () => resolve(false));
  });
}
