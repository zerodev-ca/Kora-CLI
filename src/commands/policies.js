import { KoraError } from "../client.js";

export class PolicyCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["policies", "policy"];
    }

    help() {
        return {
            title: "Policies",
            rows: [
                ["kora policies [--product P] [-s TEXT]", "Every policy and how many licenses use it"],
                ["kora policies create NAME --product P [--type subscription|perpetual] [--machines N] [--duration N --unit days|weeks|months|years]", "Add a policy"]
            ],
            note: "Issue a license under a policy with kora licenses issue --policy NAME."
        };
    }

    async run(name, args, flags) {
        const [action, ...rest] = args;
        switch (action) {
            case undefined:
            case "list":
                return this.list(flags);
            case "create":
                return this.create(rest.join(" "), flags);
            default:
                throw new KoraError(`Unknown action "${action}". Run kora help policies.`, 0);
        }
    }

    async list(flags) {
        const client = this.cli.client();
        const product = flags.product ? await this.cli.commands.find(entry => entry.names().includes("licenses")).product(flags.product) : null;
        const rows = (await client.call("GET", `/policies${client.query({ product_id: product ? product.id : undefined, search: flags.search, limit: flags.limit ? flags.limit : 100 })}`)).policies;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Id", get: row => this.cli.out.dim(row.id) },
            { label: "Name", get: row => this.cli.out.bold(row.name) },
            { label: "Product", get: row => row.product_name },
            { label: "Type", get: row => row.type },
            { label: "Max machines", get: row => row.max_machines > 0 ? row.max_machines : this.cli.out.dim("group limits") },
            { label: "Duration", get: row => row.duration > 0 ? `${row.duration} ${row.duration_unit}` : this.cli.out.dim("lifetime") },
            { label: "Licenses", get: row => row.licenses }
        ]);
        this.cli.out.count(rows.length, rows.length, "policies");
    }

    async create(name, flags) {
        const product = await this.cli.commands.find(entry => entry.names().includes("licenses")).product(await this.cli.need(flags.product, "Product: "));
        const policy = (await this.cli.client().call("POST", "/policies", {
            product_id: product.id,
            name: await this.cli.need(name, "Policy name: "),
            ...(flags.type ? { type: flags.type } : {}),
            ...(flags.machines ? { max_machines: Number(flags.machines) } : {}),
            ...(flags.duration ? { duration: Number(flags.duration), duration_unit: flags.unit ? flags.unit : "days" } : {})
        })).policy;
        if (this.cli.out.json) return this.cli.out.data(policy);
        this.cli.out.done(`Created ${this.cli.out.bold(policy.name)} for ${policy.product_name} ${this.cli.out.dim(`#${policy.id}`)}`);
    }
}
