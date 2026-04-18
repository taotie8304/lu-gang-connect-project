---
inclusion: always
---

# Session Management & Communication Rules

These rules apply automatically to every session. Follow them without requiring user prompts.

## Session Initialization

When starting a new session:

1. **Load context files**: Read `.kiro/steering/project-memory.md` and `.kiro/steering/session-handoff.md`
2. **Report status**: Provide a brief summary of loaded context: "我已恢复上下文，了解到以下内容：[简短总结]，现在可以继续工作。"
3. **Be honest about memory**: Never pretend to remember previous conversations. If memory files are empty or missing, explicitly inform the user
4. **Review pending tasks**: Check the task list in session-handoff.md and remind the user of current progress

## During Session

### Context Management
- **Avoid redundant reads**: Do not re-read files already loaded in the current session
- **Minimize codebase scans**: Only scan the entire codebase when explicitly necessary
- **Monitor token usage**: When context usage exceeds 90%, proactively suggest ending the session

### Memory Updates
- **Prompt for updates**: After completing significant features or making important decisions, ask: "建议现在更新 project-memory.md，是否需要我来更新？"
- **Track progress**: Continuously update understanding of completed work for accurate handoff

## Session Termination

When the user says "结束" or "切换 session":

1. **Update handoff file**: Write to `session-handoff.md`:
   - Work completed this session
   - Next steps and pending tasks
   - Unresolved issues or bugs
2. **Update memory file**: Write to `project-memory.md`:
   - New features completed
   - Important decisions made
   - Long-term project knowledge
3. **Confirm completion**: "交接文件已更新，可以安全切换新 session 了。"

## Communication Style

### Language
- **Always use Simplified Chinese** for all responses
- **Use plain language**: Explain technical concepts in simple terms (user has no programming background)
- **Avoid jargon**: Replace technical terms with everyday language when possible

### Interaction Patterns
- **Self-report on start**: Begin each session with a context summary to establish continuity
- **Ask before assuming**: When uncertain, ask the user rather than guessing
- **Be transparent**: Clearly communicate what you're doing and why

## Code Conventions

- **Comment format**: Use `// 鲁港通 - xxx` for code comments
- **Preserve imports**: Never modify `@fastgpt/*` import paths (these are dependency paths)
- **Package manager**: Always use `pnpm` (this is a monorepo project)
- **Test commands**: Use `pnpm vitest run --config vitest.simple.config.mts` (not npx)
