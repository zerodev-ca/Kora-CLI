# Kora CLI

`kora` puts your Kora license server in your terminal. Every command works in scripts and CI with `--json` and `--yes`, and `kora mcp` lets an AI coding assistant manage licenses and add license checks to your code.

## Install

macOS and Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/zerodev-ca/Kora-CLI/main/install.sh | sh
```

The script picks the build for your system, checks it against `checksums.txt` and installs it to `/usr/local/bin`, or `~/.local/bin` when that is not writable, and adds that folder to your shell's `PATH` when it is missing. Set `KORA_INSTALL_DIR` to choose another folder. Run it again to update.

Windows: download `kora_windows_amd64.exe` (or `kora_windows_arm64.exe`) from the latest release, rename it to `kora.exe` and put it on your `PATH`.

With Node.js 20 or newer you can also run `npm install -g @zerodev-ca/kora-cli`.

## Sign in

Create an API token on the **API Tokens** page of your Kora dashboard with the scopes you need, then:

```bash
kora login --url https://api.example.com
```

Several servers can be saved at once. `kora accounts` lists them, `kora switch` picks one and `--account NAME` runs a single command as another. Accounts are stored with mode 0600 in:

| System | File |
| --- | --- |
| macOS | `~/Library/Application Support/kora/config.json` |
| Linux | `~/.config/kora/config.json` |
| Windows | `%AppData%\kora\config.json` |

## Commands

```bash
kora licenses --status active -s jane
kora licenses show jane@example.com
kora licenses issue --product "My Plugin" --email jane@example.com --name Jane --policy Pro
kora licenses suspend 7QF2 --yes
kora licenses download 7QF2 -o jane.lic
kora products create "My Plugin" --duration 365 --unit days
kora policies create Pro --product "My Plugin" --machines 2 --duration 1 --unit years
kora customers block jane@example.com
kora customers merge 12 31
kora rules add --type ip --value 203.0.113.0/24
kora stores
kora purchases --status refunded
```

A license can be named by its full key, the start of its key, the email of a customer with one license, or its id. Run `kora help` for everything.

## Test like your product does

```bash
kora validate --key 7QF2-EDRF-CJ78-RBRT --product "My Plugin"
kora activate --key 7QF2-EDRF-CJ78-RBRT --product "My Plugin"
kora deactivate --key 7QF2-EDRF-CJ78-RBRT
kora verify-offline --file jane.lic
kora fingerprint
```

`--fingerprint` sends another machine id as `hwid`. `validate` and `verify-offline` exit with `0` when the license is valid, `1` when it is not and `2` when Kora cannot be reached.

## Scripts and CI

```bash
export KORA_URL=https://api.example.com KORA_TOKEN=kora_...
KEY=$(kora licenses issue --product "My Plugin" --email ci@example.com --json | jq -r .key)
kora licenses revoke "$KEY" --yes
```

| Variable | Use |
| --- | --- |
| `KORA_URL`, `KORA_TOKEN` | Use this server and token instead of a saved account |
| `KORA_CONFIG` | Where accounts are saved |
| `KORA_API_KEY` | Token sent by `validate`, `activate` and `deactivate` when `--url` is used |
| `KORA_PUBLIC_KEY` | Public key for `verify-offline` |
| `NO_COLOR` | Plain output |

## AI assistants

```bash
claude mcp add kora -- kora mcp
```

`kora mcp` speaks the Model Context Protocol over stdio with the signed-in account. Its tools list and issue licenses, change statuses, manage products, policies, customers and access rules, validate keys and return SDK snippets for Node.js, Python, Java, FiveM, .NET, PHP, Go and Rust. Give it a token with only the scopes it needs.

## Building

```bash
bun install
bun run typecheck
bun run build
```

`bun run build` writes single-file builds for macOS, Linux and Windows on x64 and ARM to `dist/` with `checksums.txt`.
