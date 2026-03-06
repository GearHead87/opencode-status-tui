# opencode-status-tui

Terminal UI for OpenCode account usage across supported platforms.

## Usage

```bash
pnpm install
pnpm run dev
```

Run the compiled CLI:

```bash
pnpm run build
pnpm start
```

CLI flags:

```bash
opencode-status-tui --interval 10
```

Supported refresh intervals: 10, 30, 60 seconds. Press `i` inside the TUI to cycle.

## Data sources

- `~/.local/share/opencode/auth.json`
- `~/.config/opencode/antigravity-accounts.json`
