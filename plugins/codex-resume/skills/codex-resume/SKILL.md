---
name: codex-resume
description: 用户要求无人值守开发、额度重置后继续、自动续跑，或查询和停止续跑时使用。准备清单后直接启动后台。
---

- 用户询问续跑进度时，使用 `resume_status` 查询实际项目绝对路径。已有工作目录时直接使用。报告当前任务、已验证数量、停止原因或下次检查时间。日志与时间以工具返回为准。
- 用户准备续跑时，帮助编写项目根目录的 `codex-resume.plan.json`。其中 `version` 为 1，`threadId` 是本地 Codex 会话 ID，`tasks` 是按顺序执行的 `{id, title, acceptance}` 对象数组（`acceptance` 是字符串），`test` 是通过用户确认的测试命令 argv 数组。可以指定 `maxAttempts`、`turnTimeoutMinutes`、`testTimeoutMinutes`。
- 用户要求自动续跑时，读取当前工作目录和 CODEX_THREAD_ID，自动填好上述清单，检查仓库真实测试命令并执行验证，简要说明计划和测试结果，再直接调用 resume_start，project 为项目绝对路径。用户已授权自动续跑时继续执行。只有影响实施的需求缺失时才询问。
- resume_start 返回 handoff 表示等待原会话当前轮次结束。调用成功后报告实际状态并结束本轮，让后台接管。不要在启动后继续开发，也不要把排队状态报告成已开始开发。
- 停止使用 resume_stop，再用 resume_status 确认 running 为 false。恢复使用相同计划调用 resume_start。更改已启动的计划时需先停止，并用发行包启动器菜单 6 归档旧进度。
- 后台发出的指定任务轮次要求结构化结果。此时直接完成该任务并返回要求的结果，避免重复调用启动工具。
