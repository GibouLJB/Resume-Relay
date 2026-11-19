import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';

export function executable() {
  const override = process.env.CODEX_RESUME_EXE;
  if (override) {
    if (!path.isAbsolute(override) || !override.toLowerCase().endsWith('.exe') || !existsSync(override)) {
      throw new Error('CODEX_RESUME_EXE 必须指向有效的 Codex .exe 绝对路径。');
    }
    return override;
  }
  const candidates = (process.env.PATH ?? '').split(path.delimiter)
    .map(directory => directory.replace(/^"(.*)"$/, '$1'))
    .filter(directory => path.isAbsolute(directory))
    .map(directory => path.join(directory, 'codex.exe'));
  const available = candidates.find(candidate => existsSync(candidate) &&
    spawnSync(candidate, ['--version'], { windowsHide: true, timeout: 10_000 }).status === 0);
  if (available) return available;
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const discovery = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8; ' +
    'Get-AppxPackage -Name OpenAI.Codex | ForEach-Object { Join-Path $_.InstallLocation "app/resources/codex.exe" }'
  ], { windowsHide: true, timeout: 15_000, encoding: 'utf8' });
  const installed = discovery.stdout?.trim().split(/\r?\n/).find(candidate => existsSync(candidate));
  if (!installed) throw new Error('找不到 Codex CLI。请安装 Codex 桌面客户端，或将 CODEX_RESUME_EXE 指向 codex.exe。');
  return installed;
}

