import readline from "readline";
import { parseArgs } from "util";
import { Accounts } from "./config.js";
import { Client, KoraError } from "./client.js";
import { Output } from "./output.js";
import { AccountCommands } from "./commands/account.js";
import { LicenseCommands } from "./commands/licenses.js";
import { ProductCommands } from "./commands/products.js";
import { CustomerCommands } from "./commands/customers.js";
import { RuleCommands } from "./commands/rules.js";
import { StoreCommands } from "./commands/stores.js";
import { CheckCommands } from "./commands/check.js";
import { Mcp } from "./mcp.js";

export class Cli {
    constructor() {
        this.version = "1.0.0";
        this.accounts = new Accounts();
        this.commands = [new AccountCommands(this), new LicenseCommands(this), new ProductCommands(this), new CustomerCommands(this), new RuleCommands(this), new StoreCommands(this), new CheckCommands(this)];
    }

    parse(argv) {
        const strings = ["url", "token", "name", "account", "status", "product", "customer", "email", "search", "limit", "key", "expires", "output", "file", "public-key", "fingerprint", "hwid", "version", "price", "currency", "duration", "unit", "description", "type", "value", "mode", "note", "store"];
        const booleans = ["json", "yes", "help", "reveal", "token-stdin", "all", "force"];
        const { values, positionals } = parseArgs({
            args: argv,
            strict: false,
            allowPositionals: true,
            options: {
                ...Object.fromEntries(strings.map(name => [name, { type: "string" }])),
                ...Object.fromEntries(booleans.map(name => [name, { type: "boolean" }])),
                search: { type: "string", short: "s" },
                output: { type: "string", short: "o" },
                yes: { type: "boolean", short: "y" },
                help: { type: "boolean", short: "h" }
            }
        });
        return { flags: values, positionals };
    }

    async start(argv) {
        const { flags, positionals } = this.parse(argv);
        this.flags = flags;
        this.out = new Output(flags.json === true);
        this.interactive = process.stdin.isTTY === true && process.stdout.isTTY === true && flags.json !== true;
        const [name, ...rest] = positionals;
        try {
            if (!name) return this.help();
            if (name === "help") return this.help(rest[0]);
            if (name === "mcp") return await new Mcp(this).start();
            if (["--version", "version"].includes(name)) return this.print(this.version);
            const command = this.commands.find(entry => entry.names().includes(name));
            if (!command) throw new KoraError(`Unknown command "${name}". Run kora help.`, 0);
            if (flags.help === true) return this.help(name);
            await command.run(name, rest, flags);
            return typeof process.exitCode === "number" ? process.exitCode : 0;
        } catch (error) {
            if (error.code === "cancelled") return 130;
            this.out.error(error.message);
            return error instanceof KoraError ? error.code : 1;
        }
    }

    print(text) {
        this.out.print(text);
        return 0;
    }

    help(topic) {
        const command = topic ? this.commands.find(entry => entry.names().includes(topic)) : null;
        if (command) return this.print(command.help());
        return this.print([
            `${this.out.bold("kora")} ${this.version}, the Kora license manager in your terminal`,
            "",
            this.commands.map(entry => entry.help()).join("\n\n"),
            "",
            `${this.out.bold("AI assistants")}`,
            "  kora mcp                                  Run as an MCP server over stdio",
            "",
            `${this.out.bold("Everywhere")}`,
            "  --json                                    Machine-readable output, keys unmasked",
            "  --yes, -y                                 Never ask for confirmation",
            "  --account NAME                            Run as another saved account",
            "",
            `${this.out.dim("Environment: KORA_URL and KORA_TOKEN skip saved accounts, KORA_CONFIG moves the config file, KORA_PUBLIC_KEY is used by verify-offline, NO_COLOR turns colors off.")}`
        ].join("\n"));
    }

    client(optional = false) {
        const account = this.accounts.resolve(this.flags.account);
        if (!account && optional) return null;
        if (!account) throw new KoraError("Not signed in. Run kora login.", 0);
        return new Client(account.url, account.token);
    }

    ask(question, secret = false) {
        if (!this.interactive) return Promise.reject(new KoraError(`Missing input: ${question.replace(/:\s*$/, "")}. Pass it as a flag.`, 0));
        return new Promise((resolve, reject) => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
            const write = rl["_writeToOutput"];
            if (secret) rl["_writeToOutput"] = text => write.call(rl, text.includes(question) ? text : "");
            rl.on("SIGINT", () => {
                rl.close();
                process.stdout.write("\n");
                reject(Object.assign(new Error("Cancelled"), { code: "cancelled" }));
            });
            rl.question(question, answer => {
                rl.close();
                if (secret) process.stdout.write("\n");
                resolve(answer.trim());
            });
        });
    }

    async need(value, question, secret = false) {
        if (value !== undefined && value !== null && value !== "") return value;
        const answer = await this.ask(question, secret);
        if (!answer) throw new KoraError(`${question.replace(/:\s*$/, "")} is required.`, 0);
        return answer;
    }

    async confirm(question) {
        if (this.flags.yes === true) return;
        if (!this.interactive) throw new KoraError("This needs confirmation. Add --yes to run it without a prompt.", 0);
        const answer = await this.ask(`${question} [y/N] `);
        if (!["y", "yes"].includes(answer.toLowerCase())) throw Object.assign(new Error("Cancelled"), { code: "cancelled" });
    }

    async stdin() {
        const chunks = [];
        for await (const chunk of process.stdin) chunks.push(chunk);
        return Buffer.concat(chunks).toString("utf8").trim();
    }
}
