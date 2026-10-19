import { KoraError } from "../client.js";

export class ProductCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["products", "product"];
    }

    help() {
        return {
            title: "Products",
            rows: [
                ["kora products [-s TEXT]", "Every product"],
                ["kora products create NAME [--version V] [--price P] [--currency C] [--duration N --unit days|weeks|months|years] [--description D]", "Add a product"],
                ["kora products show PRODUCT", "Details"]
            ]
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
            { label: "Id", get: row => this.cli.out.dim(row.id) },
            { label: "Name", get: row => this.cli.out.bold(row.name) },
            { label: "Version", get: row => row.version },
            { label: "Duration", get: row => row.duration > 0 ? `${row.duration} ${row.duration_unit}` : this.cli.out.dim("lifetime") },
            { label: "Status", get: row => this.cli.out.tone(row.active === false ? "disabled" : "enabled") }
        ]);
        this.cli.out.count(rows.length, rows.length, "products");
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
        this.cli.out.done(`Created ${this.cli.out.bold(product.name)} ${this.cli.out.dim(`#${product.id}`)}`);
    }

    async show(reference) {
        const product = await this.cli.client().call("GET", `/products/${encodeURIComponent(await this.cli.need(reference, "Product: "))}`);
        if (this.cli.out.json) return this.cli.out.data(product);
        this.cli.out.print();
        this.cli.out.print(`  ${this.cli.out.bold(product.name)}   ${this.cli.out.tone(product.active === false ? "disabled" : "enabled")}`);
        this.cli.out.print();
        this.cli.out.pairs([["Id", product.id], ["Version", product.version], ["Price", `${product.price} ${product.currency}`], ["Duration", product.duration > 0 ? `${product.duration} ${product.duration_unit}` : "lifetime"], ["Description", product.description]]);
    }
}
