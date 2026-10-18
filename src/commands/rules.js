import { KoraError } from "../client.js";

export class RuleCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["rules", "rule"];
    }

    help() {
        return [
            this.cli.out.bold("Access rules"),
            "  kora rules [--mode block|exclude] [--type ip|device|country]",
            "  kora rules add --type ip|device|country --value V [--mode block|exclude] [--product ID] [--note N]",
            "  kora rules remove ID"
        ].join("\n");
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
            { label: "Id", get: row => row.id },
            { label: "Mode", get: row => this.cli.out.tone(row.mode) },
            { label: "Type", get: row => row.type },
            { label: "Value", get: row => row.value },
            { label: "Product", get: row => row.product_name ? row.product_name : "all" },
            { label: "Blocked", get: row => row.hits },
            { label: "Note", get: row => row.note }
        ]);
    }

    async add(flags) {
        const rule = (await this.cli.client().call("POST", "/rules", { type: await this.cli.need(flags.type, "Type (ip, device or country): "), value: await this.cli.need(flags.value, "Value: "), mode: flags.mode ? flags.mode : "block", ...(flags.product ? { product_id: flags.product } : {}), ...(flags.note ? { note: flags.note } : {}) })).rule;
        if (this.cli.out.json) return this.cli.out.data(rule);
        this.cli.out.done(`Added rule ${rule.id}: ${rule.mode} ${rule.type} ${rule.value}.`);
    }

    async remove(id) {
        const rule = await this.cli.client().call("GET", `/rules/${encodeURIComponent(await this.cli.need(id, "Rule id: "))}`);
        await this.cli.confirm(`Remove the ${rule.mode} rule for ${rule.type} ${rule.value}?`);
        await this.cli.client().call("DELETE", `/rules/${rule.id}`);
        this.cli.out.done(`Removed rule ${rule.id}.`);
    }
}
