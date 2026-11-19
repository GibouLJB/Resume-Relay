# Resume Relay v0.2.0

Start or resume background development directly from a local Codex chat after preparing the task plan.

- Added resume_start and resume_stop alongside resume_status.
- Added a handoff phase that waits for the original chat turn to end.
- Updated the skill to prepare the task plan, verify the test command, start the worker, and end the current turn.
- Added upgrade instructions and chat workflows in Simplified Chinese, English, Traditional Chinese, and Japanese.

Download the Windows ZIP and SHA-256 file from the repository's downloads/v0.2.0 folder. Extract it, register the source with option 8 in Resume.cmd, restart Codex, and update or reinstall the plugin.

Requires Windows, Node.js 22 or later, Codex desktop, and a ChatGPT login accessible to the local CLI.

Six automated tests pass, including waiting for an active turn to finish and stopping during handoff. Live desktop handoff and multi-day runs across real account quota resets remain unverified.
