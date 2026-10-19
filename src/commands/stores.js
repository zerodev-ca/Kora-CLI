import { KoraError } from "../client.js";

export class StoreCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["stores", "purchases"];
    }

    help() {
        return {
            title: "Stores",
            rows: [
                ["kora stores", "Connected stores with their webhook and redeem URLs"],
                ["kora purchases [--status S] [-s TEXT]", "Store purchases and the licenses they issued"]
            ]
        };
    }

    async run(name, args, flags) {
        if (args.length > 0 && args[0] !== "list") throw new KoraError(`Unknown action "${args[0]}". Run kora help stores.`, 0);
        return name === "stores" ? this.stores() : this.purchases(flags);
    }

    async stores() {
        const rows = (await this.cli.client().call("GET", "/stores?limit=200")).stores;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Id", get: row => this.cli.out.dim(row.id) },
            { label: "Name", get: row => this.cli.out.bold(row.name) },
            { label: "Store", get: row => row.provider_label },
            { label: "Status", get: row => this.cli.out.tone(row.enabled ? "enabled" : "disabled") },
            { label: "Webhook URL", get: row => this.cli.out.cyan(row.hook_url) },
            { label: "Redeem page", get: row => row.redeem_url ? this.cli.out.cyan(row.redeem_url) : null }
        ]);
        this.cli.out.count(rows.length, rows.length, "stores");
    }

    async purchases(flags) {
        const client = this.cli.client();
        const rows = (await client.call("GET", `/stores/purchases${client.query({ status: flags.status, search: flags.search, limit: flags.limit ? flags.limit : 50 })}`)).purchases;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Order", get: row => this.cli.out.bold(row.order_id) },
            { label: "Store", get: row => row.connection_name },
            { label: "Buyer", get: row => row.buyer_name ? row.buyer_name : row.email },
            { label: "License", get: row => row.license_key ? this.cli.out.mask(row.license_key) : null },
            { label: "Status", get: row => this.cli.out.tone(row.status) },
            { label: "Purchased", get: row => this.cli.out.ago(row.created_at) }
        ]);
        this.cli.out.count(rows.length, rows.length, "purchases");
    }
}
