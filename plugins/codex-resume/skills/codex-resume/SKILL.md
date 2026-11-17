---
name: codex-resume
description: 帮助 Windows 用户准备 Codex 无人值守开发清单，或查询已有的 Codex 项目续跑任务与下一次额度检查时间。
---

- 用户询问续跑进度时，使用 `resume_status` 查询实际项目绝对路径。已有工作目录时直接使用。报告当前任务、已验证数量、停止原因或下次检查时间。日志与时间以工具返回为准。
- 用户准备续跑时，帮助编写项目根目录的 `codex-resume.plan.json`。其中 `version` 为 1，`threadId` 是本地 Codex 会话 ID，`tasks` 是按顺序执行的 `{id, title, acceptance}` 对象数组（`acceptance` 是字符串），`test` 是通过用户确认的测试命令 argv 数组。可以指定 `maxAttempts`、`turnTimeoutMinutes`、`testTimeoutMinutes`。
- 请用户运行同一发行包中的 `Resume.cmd`，选中项目并检查将被执行的计划。已开启续跑的会话可用于查看历史。需要手动接管开发时，先通过启动器停止续跑。
