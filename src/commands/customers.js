import { KoraError } from "../client.js";

export class CustomerCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["customers", "customer"];
    }

    help() {
        return {
            title: "Customers",
            rows: [
                ["kora customers [-s TEXT]", "Search by name, email or Discord id"],
                ["kora customers show CUSTOMER", "Details and licenses"],
                ["kora customers create --name N [--email E]", "Add a customer"],
                ["kora customers block | unblock CUSTOMER", "Stop or restore every license they own"],
                ["kora customers merge CUSTOMER DUPLICATE", "Move the duplicate's licenses over and delete it"]
            ],
            note: "CUSTOMER is an id, email or Discord id."
        };
    }

    async run(name, args, flags) {
        const [action, ...rest] = args;
        switch (action) {
            case undefined:
            case "list":
                return this.list(flags);
            case "show":
                return this.show(rest[0]);
            case "create":
                return this.create(flags);
            case "block":
            case "unblock":
                return this.block(rest[0], action === "block");
            case "merge":
                return this.merge(rest[0], rest[1]);
            default:
                throw new KoraError(`Unknown action "${action}". Run kora help customers.`, 0);
        }
    }

    async list(flags) {
        const client = this.cli.client();
        const rows = (await client.call("GET", `/customers${client.query({ search: flags.search, limit: flags.limit ? flags.limit : 50 })}`)).customers;
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [
            { label: "Id", get: row => this.cli.out.dim(row.id) },
            { label: "Name", get: row => this.cli.out.bold(row.name) },
            { label: "Email", get: row => row.email },
            { label: "Discord", get: row => row.discord_id },
            { label: "Status", get: row => this.cli.out.tone(row.blocked === true ? "blocked" : "active") }
        ]);
        this.cli.out.count(rows.length, rows.length, "customers");
    }

    async find(reference) {
        return this.cli.client().call("GET", `/customers/${encodeURIComponent(await this.cli.need(reference, "Customer: "))}`);
    }

    async show(reference) {
        const customer = await this.find(reference);
        const licenses = (await this.cli.client().call("GET", `/licenses?customer_id=${customer.id}&limit=100`)).licenses;
        if (this.cli.out.json) return this.cli.out.data({ ...customer, licenses });
        this.cli.out.print();
        this.cli.out.print(`  ${this.cli.out.bold(customer.name)}   ${this.cli.out.tone(customer.blocked === true ? "blocked" : "active")}`);
        this.cli.out.print();
        this.cli.out.pairs([["Id", customer.id], ["Email", customer.email], ["Discord", customer.discord_id], ["Notes", customer.notes]]);
        this.cli.out.heading("Licenses");
        this.cli.out.table(licenses, [{ label: "Key", get: row => this.cli.out.mask(row.key) }, { label: "Product", get: row => this.cli.out.bold(row.product_name) }, { label: "Status", get: row => this.cli.out.tone(row.status) }], false);
    }

    async create(flags) {
        const customer = (await this.cli.client().call("POST", "/customers", { name: await this.cli.need(flags.name, "Name: "), ...(flags.email ? { email: flags.email } : {}) })).customer;
        if (this.cli.out.json) return this.cli.out.data(customer);
        this.cli.out.done(`Created ${this.cli.out.bold(customer.name)} ${this.cli.out.dim(`#${customer.id}`)}`);
    }

    async block(reference, blocked) {
        const customer = await this.find(reference);
        if (blocked) await this.cli.confirm(`Block ${customer.name}? Every license they own stops validating.`);
        const updated = (await this.cli.client().call("PATCH", `/customers/${customer.id}`, { blocked })).customer;
        if (this.cli.out.json) return this.cli.out.data(updated);
        this.cli.out.done(`${this.cli.out.bold(updated.name)} is ${blocked ? "blocked" : "unblocked"}.`);
    }

    async merge(reference, duplicateReference) {
        const customer = await this.find(reference);
        const duplicate = await this.find(duplicateReference);
        await this.cli.confirm(`Merge ${duplicate.name} (id ${duplicate.id}) into ${customer.name} (id ${customer.id})? ${duplicate.name} is deleted.`);
        const merged = (await this.cli.client().call("POST", `/customers/${customer.id}/merge`, { customer_id: duplicate.id })).customer;
        if (this.cli.out.json) return this.cli.out.data(merged);
        this.cli.out.done(`Merged into ${this.cli.out.bold(merged.name)}.`);
    }
}
