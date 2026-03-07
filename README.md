# opencode-status-tui

Terminal UI for OpenCode account usage across supported platforms.

## Usage

```bash
bun install
cp .env.example .env
bun run dev
```

Set these values in `.env`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

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

## Releases

Pushing a tag like `v0.1.0` triggers the release workflow in `.github/workflows/release-linux.yml`.

The workflow will:

- build the Linux x64 standalone binary with Bun
- upload both the raw binary and a `.zip` archive to GitHub Releases
- generate release notes automatically (used as the changelog for each release)

Set these GitHub repository secrets so the workflow can create `.env` during release builds:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
