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
    *":$directory:"*) ;;
    *) echo "Add $directory to your PATH to run kora." ;;
esac
