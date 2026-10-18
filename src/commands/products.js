import { KoraError } from "../client.js";

export class ProductCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["products", "product"];
    }

    help() {
        return [
            this.cli.out.bold("Products"),
            "  kora products [-s TEXT]                                     Every product",
            "  kora products create NAME [--version V] [--price P] [--currency C] [--duration N --unit days|weeks|months|years] [--description D]",
            "  kora products show PRODUCT"
        ].join("\n");
    }

    async run(name, args, flags) {
        const [action, ...rest] = args;
        switch (action) {
            case undefined:
            case "list":
                return this.list(flags);
            case "create":
                return this.create(rest.join(" "), flags);
            case "show":
                return this.show(rest.join(" "));
            default:
                throw new KoraError(`Unknown action "${action}". Run kora help products.`, 0);
        }
    }

    async list(flags) {
        const client = this.cli.client();
        const rows = (await client.call("GET", `/products${client.query({ search: flags.search, limit: flags.limit ? flags.limit : 100 })}`)).products;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Id", get: row => row.id },
            { label: "Name", get: row => this.cli.out.bold(row.name) },
            { label: "Version", get: row => row.version },
            { label: "Duration", get: row => row.duration > 0 ? `${row.duration} ${row.duration_unit}` : "lifetime" },
            { label: "Status", get: row => row.active === false ? this.cli.out.dim("disabled") : this.cli.out.green("enabled") }
        ]);
    }

    async create(name, flags) {
        const product = (await this.cli.client().call("POST", "/products", {
            name: await this.cli.need(name, "Product name: "),
            ...(flags.version ? { version: flags.version } : {}),
            ...(flags.price ? { price: Number(flags.price) } : {}),
            ...(flags.currency ? { currency: flags.currency } : {}),
            ...(flags.duration ? { duration: Number(flags.duration), duration_unit: flags.unit ? flags.unit : "days" } : {}),
            ...(flags.description ? { description: flags.description } : {})
        })).product;
        if (this.cli.out.json) return this.cli.out.data(product);
        this.cli.out.done(`Created ${this.cli.out.bold(product.name)} (id ${product.id}).`);
    }

    async show(reference) {
        const product = await this.cli.client().call("GET", `/products/${encodeURIComponent(await this.cli.need(reference, "Product: "))}`);
        if (this.cli.out.json) return this.cli.out.data(product);
        this.cli.out.pairs([["Name", this.cli.out.bold(product.name)], ["Id", product.id], ["Version", product.version], ["Price", `${product.price} ${product.currency}`], ["Duration", product.duration > 0 ? `${product.duration} ${product.duration_unit}` : "lifetime"], ["Status", product.active === false ? "disabled" : "enabled"], ["Description", product.description]]);
    }
}
