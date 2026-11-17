# 续程（Resume Relay）· Windows

A Windows plugin and background runner for Codex. It waits for usage limits to reset, resumes the original local session, and works through a task checklist. It runs tests after each task, logs progress, and stops when all tasks pass.

把已有 Codex 本地会话和一份开发清单交给 Windows 续跑器。它使用同一 ChatGPT 登录查询 Codex 额度，等待服务端报告的重置时间，再恢复原会话。每项任务都要由 Codex 报告可验收，并由续跑器独立运行你确认的测试命令。全部通过后后台进程自动退出。

## 安装

1. 安装最新版 [Codex Windows 客户端](https://learn.chatgpt.com/docs/windows/windows-app) 和 [Node.js 22 或更新版本](https://nodejs.org/)。在 Codex 中登录 ChatGPT，选择 Windows 本地项目。
2. 从 [GitHub Releases](https://github.com/GibouLJB/Resume-Relay/releases/latest) 下载 Windows ZIP，解压到要长期保留的文件夹。双击 `Resume.cmd`，选择「注册桌面插件来源」。重启 Codex，在插件目录选择 **Resume Relay**，安装 **续程 · Codex 项目续跑**。若刚安装 Node.js，重启桌面客户端以刷新 PATH。
3. 在目标项目的桌面会话中先发送一条消息，确认项目使用本地工作目录。若使用 Git 工作树，请选择会话实际使用的工作树目录。

安装插件后，可在该项目的新聊天里问「帮我查看这个项目的续跑进度」。Windows 启动器负责开始、恢复和停止；插件负责准备清单和读取进度。

## 首次续跑

1. 打开 `Resume.cmd`，选择「创建任务清单」，粘贴项目文件夹路径，再选择原会话。如列表没有显示该会话，可以粘贴会话 UUID。
2. 编辑项目根目录下的 `codex-resume.plan.json`，填写有明确验收条件的任务，并设置能通过退出码表达成功或失败的测试命令。发行包附有 [任务清单示例](examples/codex-resume.plan.json)。
3. 选择「检查账号与额度接口」验证登录与额度查询。确认原会话已经完成正在进行的工作，并在续跑期间通过另一聊天查看进度，避免同时修改同一个会话或工作目录。
4. 选择「在后台启动或恢复续跑」，检查完整计划和测试命令，输入 `YES`。后台续跑器启动后可以关闭启动器和 Codex 客户端。首次排查也可以选择「在当前窗口启动续跑」看实时输出。
5. 随时通过插件或启动器查看进度。停止时打开启动器并选择「停止续跑」。再启动会从保留的任务与阶段继续。等待额度时停止，下一次启动会保留原定检查时间。

电脑必须保持开机且用户保持登录才能运行后台进程。睡眠期间不执行任务，唤醒后会继续检查。重启或注销后，重新打开启动器并选择「在后台启动或恢复续跑」。

### 任务清单

| 字段 | 用途 |
| --- | --- |
| `version` | 当前为 `1` |
| `threadId` | 本地项目原始会话的 UUID |
| `tasks` | 1–200 项，顺序执行。每项包含唯一的 `id`、`title` 和 `acceptance` |
| `test` | 以数组明确指定可执行文件和参数。第一项为程序，后续为各个参数 |
| `maxAttempts` | 每项最多开发轮数，默认 4，可设 1–20。额度中断不占用开发轮数 |
| `turnTimeoutMinutes` | 单轮开发超时，默认 90 分钟，可设 1–360 |
| `testTimeoutMinutes` | 单次测试超时，默认 20 分钟，可设 1–120 |

测试示例包括 `["python.exe", "-m", "pytest"]` 或 `["node.exe", "--test"]`。对 npm 的 Windows 脚本，可参考示例中的 PowerShell 调用和退出码传播。续跑期间会使用 Codex 工作区沙箱执行，提前准备依赖并确认测试能在当前的 Windows 沙箱配置中运行。测试需要已有项目代码可信。网络隔离能力取决于配置的 Windows 沙箱实现。 [Windows 沙箱文档](https://learn.chatgpt.com/docs/windows/windows-sandbox)

改动已启动计划中的会话、任务或测试命令，需要先停止并用启动器「归档旧进度」，再审核新计划。归档后会按新清单从第一项开始，项目文件里的已有改动会保留。

## 状态和排障

| 状态 | 含义 |
| --- | --- |
| `queued` / `developing` / `testing` | 启动、开发或测试中 |
| `waiting` | 等待额度检查或临时服务错误退避，`nextCheck` 为预计检查时间。已耗尽的主、次窗口同时生效时，以较晚的重置时间为准 |
| `complete` | 所有任务均已通过测试，后台进程退出 |
| `stopped` / `interrupted` | 用户请求停止，或进程已意外退出。重新启动会读取本地检查点 |
| `blocked` | 需要处理登录、权限、测试、会话或其他失败，具体原因见 `note` |

- 进度和有上限的测试输出保存在 `%LOCALAPPDATA%\CodexResume\<项目标识>\progress.jsonl`，后台启动输出在同目录下的 `worker.log`。插件能读到状态概要和日志路径。日志可能包含项目内容，分享前先查看。
- 默认寻找 PATH 中的 `codex.exe`，也会查找 Windows 应用包中的 Codex。可用环境变量 `CODEX_RESUME_EXE` 指向已安装的原生 `codex.exe`。桌面端与续跑器必须共享这个会话的本地 Codex 数据目录和 ChatGPT 登录。
- 若 CLI 能启动但找不到会话，检查实际工作目录、本地和云端执行模式，以及是否使用了不同的 `CODEX_HOME`。工具只恢复能由本地 App Server 读取的会话。
- 额度按 App Server 返回的实际窗口判断，额度时间未知时低频复查。遇到额度拒绝但服务端没有报告耗尽窗口，退避重试有上限。工具不调用额度重置券接口。 [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- 组织策略、缺失权限或需要手动回答的问题可能令任务停止。处理后使用同一清单恢复。插件和续跑器使用当前 Windows 用户运行，依赖 Codex 本身的企业管理策略和沙箱实现。

也可以在 PowerShell 里直接执行：

```powershell
.\Resume.cmd install
.\Resume.cmd init 'D:\My Projects\Example'
.\Resume.cmd background 'D:\My Projects\Example'
.\Resume.cmd status 'D:\My Projects\Example'
.\Resume.cmd stop 'D:\My Projects\Example'
```

卸载时，先停止任务，再在 Codex 插件目录卸载插件。从 PowerShell 运行 `codex plugin marketplace remove codex-resume-tools` 移除本地来源。日志和检查点仍可在上述本地数据目录查看。

## 构建和分发

```powershell
node --test test/worker.test.mjs
.\scripts\package.ps1
```

发布脚本在 `dist` 生成 Windows ZIP 和 SHA-256 校验文件。也可以通过 `codex plugin marketplace add GibouLJB/Resume-Relay` 注册插件来源。Windows 续跑器通过同一发行版的 `Resume.cmd` 启动。

正式上架通用插件目录时，本插件的本地 MCP 组件需要 OpenAI 批准提交资格，还需提交发布者资料、清洁安装结果和官方审查。GitHub Releases 安装路径可以独立使用。 [插件打包](https://developers.openai.com/plugins/build/plugins) · [桌面专用插件提交](https://developers.openai.com/plugins/deploy/desktop-only)
