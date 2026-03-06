# opencode-status-tui

Terminal UI for OpenCode account usage across supported platforms.

## Usage

```bash
bun install
bun run dev
```

Build a Linux standalone binary:

```bash
bun run build
```

Run the compiled CLI (no Node.js required):

```bash
./dist/opencode-status-tui
```

CLI flags:

```bash
opencode-status-tui --interval 10
```

or

```bash
./dist/opencode-status-tui --interval 10
```

Supported refresh intervals: 10, 30, 60 seconds. Press `i` inside the TUI to cycle.

## Data sources

- `~/.local/share/opencode/auth.json`
- `~/.config/opencode/antigravity-accounts.json`
