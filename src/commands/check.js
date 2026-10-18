import fs from "fs";
import os from "os";
import { execFileSync } from "child_process";
import { createHash, createPublicKey, verify } from "crypto";
import { Client, KoraError } from "../client.js";

export class CheckCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["validate", "activate", "deactivate", "verify-offline", "fingerprint", "public-key"];
    }

    help() {
        return [
            this.cli.out.bold("Test like your product does"),
            "  kora validate --key KEY [--product P] [--fingerprint ID]     Exit 0 valid, 1 rejected, 2 unreachable",
            "  kora activate --key KEY [--product P] [--fingerprint ID]     Take a seat for this machine, then validate",
            "  kora deactivate --key KEY [--fingerprint ID]                 Free this machine's seat",
            "  kora verify-offline --file FILE [--public-key FILE]          Check a signed license file with no network",
            "  kora public-key                                              The key that signs answers and files",
            "  kora fingerprint                                             This machine's id, sent as hwid",
            this.cli.out.dim("  These use the signed-in server, or --url. --fingerprint defaults to this machine's id.")
        ].join("\n");
    }

    async run(name, args, flags) {
        switch (name) {
            case "fingerprint":
                return this.cli.out.json ? this.cli.out.data({ fingerprint: this.fingerprint() }) : this.cli.out.print(this.fingerprint());
            case "public-key":
                return this.publicKey();
            case "verify-offline":
                return this.offline(flags);
            case "deactivate":
                return this.deactivate(flags);
            default:
                return this.validate(name, flags);
        }
    }

    client() {
        if (this.cli.flags.url) return new Client(this.cli.flags.url.replace(/\/api\/v1\/?$/, ""), process.env.KORA_API_KEY);
        const account = this.cli.client(true);
        if (account) return account;
        if (process.env.KORA_URL) return new Client(process.env.KORA_URL, process.env.KORA_API_KEY);
        throw new KoraError("Pass --url or run kora login first.", 0);
    }

    fingerprint() {
        const read = (command, args, pattern) => {
            try {
                const match = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).match(pattern);
                return match ? match[1] : "";
            } catch {
                return "";
            }
        };
        const machine = (() => {
            switch (process.platform) {
                case "darwin":
                    return read("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], /"IOPlatformUUID" = "([^"]+)"/);
                case "win32":
                    return read("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], /MachineGuid\s+REG_SZ\s+(\S+)/);
                default:
                    return ["/etc/machine-id", "/var/lib/dbus/machine-id"].filter(file => fs.existsSync(file)).map(file => fs.readFileSync(file, "utf8").trim()).concat([""])[0];
            }
        })();
        return createHash("sha256").update(`kora:${machine ? machine : os.hostname()}`).digest("hex").slice(0, 32);
    }

    body(flags) {
        return { license_key: flags.key, hwid: flags.fingerprint ? flags.fingerprint : this.fingerprint(), ...(flags.product ? { product_name: flags.product } : {}) };
    }

    async validate(name, flags) {
        if (!flags.key) throw new KoraError("Pass --key.", 0);
        const reply = await this.client().send("POST", `/licenses/${name}`, this.body(flags), { auth: true });
        const result = reply.data;
        if (this.cli.out.json) this.cli.out.data(result);
        if (!this.cli.out.json) this.cli.out.print(result.valid ? `${this.cli.out.green("✓ VALID")} ${result.message}` : `${this.cli.out.red(`✗ ${String(result.code).toUpperCase()}`)} ${result.message}`);
        if (!result.valid) process.exitCode = 1;
    }

    async deactivate(flags) {
        if (!flags.key) throw new KoraError("Pass --key.", 0);
        const result = (await this.client().send("POST", "/licenses/deactivate", this.body(flags))).data;
        if (this.cli.out.json) this.cli.out.data(result);
        if (!this.cli.out.json) this.cli.out.print(result.success ? `${this.cli.out.green("✓")} ${result.message}` : `${this.cli.out.red("✗")} ${result.message}`);
        if (!result.success) process.exitCode = 1;
    }

    async key(flags) {
        if (flags["public-key"]) return fs.readFileSync(flags["public-key"], "utf8");
        if (process.env.KORA_PUBLIC_KEY) return process.env.KORA_PUBLIC_KEY.replace(/\\n/g, "\n");
        return (await this.client().send("GET", "/public-key", undefined, { auth: false })).data.publicKey;
    }

    async publicKey() {
        const key = await this.key({});
        if (this.cli.out.json) return this.cli.out.data({ publicKey: key });
        process.stdout.write(key.endsWith("\n") ? key : `${key}\n`);
    }

    async offline(flags) {
        if (!flags.file) throw new KoraError("Pass --file.", 0);
        const [payload, signature] = fs.readFileSync(flags.file, "utf8").trim().split(".");
        if (!payload || !signature) throw new KoraError("That is not a Kora license file.", 0);
        const text = Buffer.from(payload, "base64url").toString("utf8");
        const authentic = verify(null, Buffer.from(text, "utf8"), createPublicKey(await this.key(flags)), Buffer.from(signature, "base64url"));
        const license = authentic ? JSON.parse(text) : null;
        const problem = !authentic ? "signature does not match" : (Date.parse(license.refresh_after) < Date.now() ? "needs a refresh online" : (license.expires_at && Date.parse(license.expires_at) < Date.now() ? "expired" : ""));
        if (this.cli.out.json) this.cli.out.data({ valid: problem === "", problem: problem ? problem : null, license });
        if (!this.cli.out.json && problem) this.cli.out.print(`${this.cli.out.red("✗ INVALID")} ${problem}`);
        if (!this.cli.out.json && !problem) {
            this.cli.out.print(`${this.cli.out.green("✓ VALID")} signed by your Kora server`);
            this.cli.out.pairs([["Key", license.key], ["Product", license.product.name], ["Customer", license.customer ? license.customer.name : null], ["Expires", license.expires_at ? this.cli.out.date(license.expires_at) : "never"], ["Refresh after", this.cli.out.date(license.refresh_after)]]);
        }
        if (problem) process.exitCode = 1;
    }
}
