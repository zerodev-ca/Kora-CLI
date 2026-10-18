import { KoraError } from "../client.js";

export class StoreCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["stores", "purchases"];
    }

    help() {
        return [
            this.cli.out.bold("Stores"),
            "  kora stores                                    Connected stores with their webhook and redeem URLs",
            "  kora purchases [--status S] [-s TEXT]          Store purchases and the licenses they issued"
        ].join("\n");
    }

    async run(name, args, flags) {
        if (args.length > 0 && args[0] !== "list") throw new KoraError(`Unknown action "${args[0]}". Run kora help stores.`, 0);
        return name === "stores" ? this.stores() : this.purchases(flags);
    }

    async stores() {
        const rows = (await this.cli.client().call("GET", "/stores?limit=200")).stores;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Id", get: row => row.id },
            { label: "Name", get: row => this.cli.out.bold(row.name) },
            { label: "Store", get: row => row.provider_label },
            { label: "Status", get: row => row.enabled ? this.cli.out.green("enabled") : this.cli.out.dim("disabled") },
            { label: "Webhook URL", get: row => row.hook_url },
            { label: "Redeem page", get: row => row.redeem_url }
        ]);
    }

    async purchases(flags) {
        const client = this.cli.client();
        const rows = (await client.call("GET", `/stores/purchases${client.query({ status: flags.status, search: flags.search, limit: flags.limit ? flags.limit : 50 })}`)).purchases;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Order", get: row => row.order_id },
            { label: "Store", get: row => row.connection_name },
            { label: "Buyer", get: row => row.buyer_name ? row.buyer_name : row.email },
            { label: "License", get: row => row.license_key ? this.cli.out.mask(row.license_key) : null },
            { label: "Status", get: row => this.cli.out.tone(row.status) },
            { label: "Purchased", get: row => this.cli.out.date(row.created_at) }
        ]);
    }
}
