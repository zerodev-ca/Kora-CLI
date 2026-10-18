#!/bin/sh
set -eu

reset=""
red=""
green=""
dim=""
bold=""
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    reset="$(printf '\033[0m')"
    red="$(printf '\033[0;31m')"
    green="$(printf '\033[0;32m')"
    dim="$(printf '\033[0;2m')"
    bold="$(printf '\033[1m')"
fi

fail() {
    printf '%serror%s: %s\n' "$red" "$reset" "$1" >&2
    exit 1
}

repository="https://github.com/zerodev-ca/Kora-CLI/releases/latest/download"
directory="${KORA_INSTALL_DIR:-/usr/local/bin}"

case "$(uname -s)" in
    Darwin) system="darwin" ;;
    Linux) system="linux" ;;
    *) fail "$(uname -s) is not supported, download a build from $repository" ;;
esac

case "$(uname -m)" in
    x86_64 | amd64) architecture="amd64" ;;
    arm64 | aarch64) architecture="arm64" ;;
    *) fail "$(uname -m) is not supported" ;;
esac

file="kora_${system}_${architecture}"
temporary="$(mktemp -d)"
trap 'rm -rf "$temporary"' EXIT

curl --fail --location --progress-bar "$repository/$file" --output "$temporary/$file" || fail "could not download $file"
curl -fsSL "$repository/checksums.txt" --output "$temporary/checksums.txt" || fail "could not download checksums.txt"

expected="$(grep " $file\$" "$temporary/checksums.txt" | cut -d ' ' -f 1)"
actual="$( (sha256sum "$temporary/$file" 2>/dev/null || shasum -a 256 "$temporary/$file") | cut -d ' ' -f 1)"
[ "$expected" = "$actual" ] || fail "checksum mismatch for $file"

if [ ! -w "$directory" ]; then
    directory="$HOME/.local/bin"
    mkdir -p "$directory"
fi

chmod +x "$temporary/$file"
mv "$temporary/$file" "$directory/kora"

case ":$PATH:" in
    *":$directory:"*)
        printf '\n%s✓%s %skora%s was installed successfully\n' "$green" "$reset" "$bold" "$reset"
        printf '  %sRun %skora%s%s to get started%s\n\n' "$dim" "$reset$bold" "$reset" "$dim" "$reset"
        exit 0
        ;;
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
grep -qsF "$line" "$profile" || printf '\n%s\n' "$line" >> "$profile"

printf '\n%s✓%s %skora%s was installed successfully\n' "$green" "$reset" "$bold" "$reset"
printf '  %sRelaunch your terminal to run %skora%s\n\n' "$dim" "$reset$bold" "$reset"
