import { KoraError } from "../client.js";

export class RuleCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["rules", "rule"];
    }

    help() {
        return {
            title: "Access rules",
            rows: [
                ["kora rules [--mode block|exclude] [--type ip|device|country]", "Every rule"],
                ["kora rules add --type ip|device|country --value V [--mode block|exclude] [--product ID] [--note N]", "Block or exclude an IP, device or country"],
                ["kora rules remove ID", "Remove a rule"]
            ]
        };
    }

    async run(name, args, flags) {
        const [action, ...rest] = args;
        switch (action) {
            case undefined:
            case "list":
                return this.list(flags);
            case "add":
                return this.add(flags);
            case "remove":
                return this.remove(rest[0]);
            default:
                throw new KoraError(`Unknown action "${action}". Run kora help rules.`, 0);
        }
    }

    async list(flags) {
        const client = this.cli.client();
        const rows = (await client.call("GET", `/rules${client.query({ mode: flags.mode, type: flags.type, limit: 200 })}`)).rules;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Id", get: row => this.cli.out.dim(row.id) },
            { label: "Mode", get: row => this.cli.out.tone(row.mode) },
            { label: "Type", get: row => row.type },
            { label: "Value", get: row => this.cli.out.bold(row.value) },
            { label: "Product", get: row => row.product_name ? row.product_name : this.cli.out.dim("all") },
            { label: "Blocked", get: row => row.hits },
            { label: "Note", get: row => row.note }
        ]);
        this.cli.out.count(rows.length, rows.length, "rules");
    }

    async add(flags) {
        const rule = (await this.cli.client().call("POST", "/rules", { type: await this.cli.need(flags.type, "Type (ip, device or country): "), value: await this.cli.need(flags.value, "Value: "), mode: flags.mode ? flags.mode : "block", ...(flags.product ? { product_id: flags.product } : {}), ...(flags.note ? { note: flags.note } : {}) })).rule;
        if (this.cli.out.json) return this.cli.out.data(rule);
        this.cli.out.done(`Added ${this.cli.out.tone(rule.mode)} rule for ${rule.type} ${this.cli.out.bold(rule.value)} ${this.cli.out.dim(`#${rule.id}`)}`);
    }

    async remove(id) {
        const rule = await this.cli.client().call("GET", `/rules/${encodeURIComponent(await this.cli.need(id, "Rule id: "))}`);
        await this.cli.confirm(`Remove the ${rule.mode} rule for ${rule.type} ${rule.value}?`);
        await this.cli.client().call("DELETE", `/rules/${rule.id}`);
        this.cli.out.done(`Removed rule ${rule.id}.`);
    }
}
