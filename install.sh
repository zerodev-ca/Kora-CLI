#!/bin/sh
set -eu

repository="https://github.com/zerodev-ca/Kora-CLI/releases/latest/download"
directory="${KORA_INSTALL_DIR:-/usr/local/bin}"

case "$(uname -s)" in
    Darwin) system="darwin" ;;
    Linux) system="linux" ;;
    *) echo "Unsupported system $(uname -s). Download a build from $repository instead." >&2; exit 1 ;;
esac

case "$(uname -m)" in
    x86_64 | amd64) architecture="amd64" ;;
    arm64 | aarch64) architecture="arm64" ;;
    *) echo "Unsupported architecture $(uname -m)." >&2; exit 1 ;;
esac

file="kora_${system}_${architecture}"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

curl -fsSL "$repository/$file" -o "$temporary/$file"
curl -fsSL "$repository/checksums.txt" -o "$temporary/checksums.txt"

expected="$(grep " $file\$" "$temporary/checksums.txt" | cut -d ' ' -f 1)"
actual="$( (sha256sum "$temporary/$file" 2>/dev/null || shasum -a 256 "$temporary/$file") | cut -d ' ' -f 1)"
if [ "$expected" != "$actual" ]; then
    echo "Checksum mismatch for $file." >&2
    exit 1
fi

if [ ! -w "$directory" ]; then
    directory="$HOME/.local/bin"
    mkdir -p "$directory"
fi

chmod +x "$temporary/$file"
mv "$temporary/$file" "$directory/kora"
echo "Installed kora to $directory/kora"
case ":$PATH:" in
    *":$directory:"*) exit 0 ;;
esac

case "$(basename "${SHELL:-sh}")" in
    zsh) profile="${ZDOTDIR:-$HOME}/.zshrc"; line="export PATH=\"$directory:\$PATH\"" ;;
    bash) profile="$HOME/.bashrc"; line="export PATH=\"$directory:\$PATH\"" ;;
    fish) profile="$HOME/.config/fish/config.fish"; line="fish_add_path \"$directory\"" ;;
    *) profile="$HOME/.profile"; line="export PATH=\"$directory:\$PATH\"" ;;
esac

if [ "$(uname -s)" = "Darwin" ] && [ "$profile" = "$HOME/.bashrc" ]; then
    profile="$HOME/.bash_profile"
fi

mkdir -p "$(dirname "$profile")"
touch "$profile"
if ! grep -qsF "$line" "$profile"; then
    printf '\n%s\n' "$line" >> "$profile"
    echo "Added $directory to your PATH in $profile"
fi
echo "Open a new terminal, or run this to use kora now:"
echo "  $line"
