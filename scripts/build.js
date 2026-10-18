import { createHash } from "crypto";
import { readFileSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";

const targets = [["darwin", "x64", "amd64"], ["darwin", "arm64", "arm64"], ["linux", "x64", "amd64"], ["linux", "arm64", "arm64"], ["windows", "x64", "amd64"], ["windows", "arm64", "arm64"]];
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
const sums = targets.map(([os, arch, label]) => {
    const file = `dist/kora_${os}_${label}${os === "windows" ? ".exe" : ""}`;
    const result = spawnSync("bun", ["build", "--compile", "--minify", `--target=bun-${os}-${arch}`, "src/index.js", "--outfile", file], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status);
    return `${createHash("sha256").update(readFileSync(file)).digest("hex")}  ${file.slice(5)}`;
});
writeFileSync("dist/checksums.txt", `${sums.join("\n")}\n`);
console.log(sums.join("\n"));
