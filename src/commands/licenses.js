import fs from "fs";
import { KoraError } from "../client.js";

export class LicenseCommands {
    constructor(cli) {
        this.cli = cli;
        this.shortcuts = { suspend: "suspended", revoke: "revoked", reinstate: "active" };
    }

    names() {
        return ["licenses", "license"];
    }

    help() {
        return [
            this.cli.out.bold("Licenses"),
            "  kora licenses [--status S] [--product P] [-s TEXT] [--reveal]   Newest first, keys masked",
            "  kora licenses show LICENSE                                       Details, seats and recent checks",
            "  kora licenses issue --product P (--customer C | --email E) [--name N] [--key K] [--expires DATE]",
            "  kora licenses suspend | revoke | reinstate LICENSE               Change the status",
            "  kora licenses status LICENSE STATUS                              Any configured status",
            "  kora licenses download LICENSE [-o FILE]                         Signed offline file, - for stdout",
            "  kora licenses delete LICENSE",
            this.cli.out.dim("  LICENSE is a full key, the start of a key, a customer email with one license, or an id.")
        ].join("\n");
    }

    async run(name, args, flags) {
        const [action, ...rest] = args;
        switch (action) {
            case undefined:
            case "list":
                return this.list(flags);
            case "show":
                return this.show(rest[0]);
            case "issue":
            case "create":
                return this.issue(flags);
            case "suspend":
            case "revoke":
            case "reinstate":
                return this.status(rest[0], this.shortcuts[action], action !== "reinstate");
            case "status":
                return this.status(rest[0], rest[1], true);
            case "download":
                return this.download(rest[0], flags);
            case "delete":
                return this.remove(rest[0]);
            default:
                throw new KoraError(`Unknown action "${action}". Run kora help licenses.`, 0);
        }
    }

    async list(flags) {
        const client = this.cli.client();
        const product = flags.product ? await this.product(flags.product) : null;
        const page = await client.call("GET", `/licenses${client.query({ status: flags.status, product_id: product ? product.id : undefined, search: flags.search, limit: flags.limit ? flags.limit : 50 })}`);
        if (this.cli.out.json) return this.cli.out.data(page.licenses);
        this.cli.out.table(page.licenses, [
            { label: "Key", get: row => flags.reveal === true ? row.key : this.cli.out.mask(row.key) },
            { label: "Product", get: row => row.product_name },
            { label: "Customer", get: row => row.customer_name },
            { label: "Status", get: row => this.cli.out.tone(row.status) },
            { label: "Seats", get: row => row.seats.join(", ") },
            { label: "Expires", get: row => row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "never" },
            { label: "Last check", get: row => row.last_validated_at ? this.cli.out.date(row.last_validated_at) : "never" }
        ]);
        if (page.total > page.licenses.length) this.cli.out.print(this.cli.out.dim(`Showing ${page.licenses.length} of ${page.total}. Use --limit or -s to narrow it.`));
    }

    async product(reference) {
        const client = this.cli.client();
        const direct = /^\d+$/.test(String(reference)) ? await client.send("GET", `/products/${reference}`) : null;
        if (direct && direct.status === 200) return direct.data;
        const rows = (await client.call("GET", `/products${client.query({ search: reference, limit: 50 })}`)).products;
        const found = rows.find(row => String(row.id) === String(reference) || row.name.toLowerCase() === String(reference).toLowerCase());
        if (!found) throw new KoraError(`No product named "${reference}".`, 404);
        return found;
    }

    async resolve(reference) {
        const client = this.cli.client();
        if (!reference) {
            const recent = (await client.call("GET", "/licenses?limit=15")).licenses;
            if (recent.length === 0) throw new KoraError("There are no licenses yet.", 0);
            const picked = await this.cli.need(null, `${recent.map((row, index) => `  ${String(index + 1).padStart(2)}. ${this.cli.out.mask(row.key)}  ${row.product_name}  ${row.customer_name}`).join("\n")}\nLicense number: `);
            if (!recent[Number(picked) - 1]) throw new KoraError("Pick one of the listed numbers.", 0);
            return recent[Number(picked) - 1];
        }
        const text = String(reference).trim();
        if (text.includes("@")) {
            const customer = (await client.call("GET", `/customers${client.query({ search: text, limit: 5 })}`)).customers.find(row => row.email === text.toLowerCase());
            const owned = customer ? (await client.call("GET", `/licenses?customer_id=${customer.id}&limit=5`)).licenses : [];
            if (owned.length !== 1) throw new KoraError(owned.length === 0 ? `No license for ${text}.` : `${text} has ${owned.length} licenses. Use a key instead.`, 404);
            return owned[0];
        }
        const exact = await client.send("GET", `/licenses/${encodeURIComponent(text)}`);
        if (exact.status === 200) return exact.data;
        const matches = (await client.call("GET", `/licenses${client.query({ search: text.toUpperCase(), limit: 10 })}`)).licenses.filter(row => row.key.startsWith(text.toUpperCase()));
        if (matches.length !== 1) throw new KoraError(matches.length === 0 ? `No license matches "${text}".` : `"${text}" matches ${matches.length} licenses. Type more of the key.`, 404);
        return matches[0];
    }

    async show(reference) {
        const license = await this.resolve(reference);
        const client = this.cli.client();
        const [seats, checks] = await Promise.all([
            client.call("GET", `/licenses/whitelists?license_id=${license.id}`).then(page => page.whitelists).catch(() => []),
            client.call("GET", `/validations?license_id=${license.id}&limit=5`).then(page => page.rows ? page.rows : page.validations).catch(() => [])
        ]);
        if (this.cli.out.json) return this.cli.out.data({ ...license, seats_detail: seats, recent_checks: checks });
        this.cli.out.pairs([
            ["Key", this.cli.out.bold(license.key)],
            ["Status", this.cli.out.tone(license.status)],
            ["Product", license.product_name],
            ["Customer", license.customer ? `${license.customer.name}${license.customer.email ? ` <${license.customer.email}>` : ""}` : null],
            ["Addons", license.addon_names.join(", ")],
            ["Expires", license.expires_at ? this.cli.out.date(license.expires_at) : "never"],
            ["Issued", this.cli.out.date(license.created_at)],
            ["Last check", this.cli.out.date(license.last_validated_at)]
        ]);
        this.cli.out.print();
        this.cli.out.print(this.cli.out.bold("Seats"));
        this.cli.out.table(seats, [{ label: "Group", get: row => row.group_name }, { label: "Value", get: row => row.value }, { label: "Added", get: row => this.cli.out.date(row.created_at) }]);
        this.cli.out.print();
        this.cli.out.print(this.cli.out.bold("Recent checks"));
        this.cli.out.table(Array.isArray(checks) ? checks : [], [{ label: "Time", get: row => this.cli.out.date(row.created_at) }, { label: "Result", get: row => this.cli.out.tone(row.code) }, { label: "IP", get: row => row.ip }, { label: "Country", get: row => row.country }, { label: "Device", get: row => row.hwid }]);
    }

    async customer(flags) {
        const client = this.cli.client();
        if (flags.customer) return flags.customer;
        const email = (await this.cli.need(flags.email, "Customer email: ")).toLowerCase();
        const found = (await client.call("GET", `/customers${client.query({ search: email, limit: 5 })}`)).customers.find(row => row.email === email);
        if (found) return found.id;
        return (await client.call("POST", "/customers", { name: flags.name ? flags.name : "", email })).customer.id;
    }

    async issue(flags) {
        const client = this.cli.client();
        const product = await this.product(await this.cli.need(flags.product, "Product: "));
        const license = (await client.call("POST", "/licenses", { product_id: product.id, customer_id: await this.customer(flags), ...(flags.key ? { key: flags.key } : {}), ...(flags.expires ? { expires_at: flags.expires } : {}), ...(flags.status ? { status: flags.status } : {}) })).license;
        if (this.cli.out.json) return this.cli.out.data(license);
        this.cli.out.done(`Issued ${this.cli.out.bold(license.key)} for ${license.product_name} to ${license.customer_name}.`);
    }

    async status(reference, status, ask) {
        if (!status) throw new KoraError("Name the status, for example kora licenses status KEY suspended.", 0);
        const license = await this.resolve(reference);
        if (ask) await this.cli.confirm(`Set ${this.cli.out.mask(license.key)} (${license.product_name}, ${license.customer_name}) to ${status}?`);
        const updated = (await this.cli.client().call("PATCH", `/licenses/${license.id}`, { status })).license;
        if (this.cli.out.json) return this.cli.out.data(updated);
        this.cli.out.done(`${this.cli.out.mask(updated.key)} is now ${this.cli.out.tone(updated.status)}.`);
    }

    async download(reference, flags) {
        const license = await this.resolve(reference);
        const reply = await this.cli.client().send("GET", `/licenses/${license.id}/file`);
        if (reply.status >= 400) throw new KoraError(reply.data && reply.data.error ? reply.data.error : `Kora answered with status ${reply.status}`, reply.status);
        if (flags.output === "-") return process.stdout.write(`${reply.text.trim()}\n`);
        const file = flags.output ? flags.output : `license-${license.key.slice(0, 5).replace(/-/g, "")}.lic`;
        fs.writeFileSync(file, `${reply.text.trim()}\n`);
        if (this.cli.out.json) return this.cli.out.data({ file, key: license.key });
        this.cli.out.done(`Saved ${this.cli.out.bold(file)}. Check it with kora verify-offline --file ${file}.`);
    }

    async remove(reference) {
        const license = await this.resolve(reference);
        await this.cli.confirm(`Delete ${this.cli.out.mask(license.key)} (${license.product_name}, ${license.customer_name})? This cannot be undone.`);
        await this.cli.client().call("DELETE", `/licenses/${license.id}`);
        this.cli.out.done(`Deleted ${this.cli.out.mask(license.key)}.`);
    }
}
