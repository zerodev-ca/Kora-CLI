import readline from "readline";
import { Snippets } from "./snippets.js";

export class Mcp {
    constructor(cli) {
        this.cli = cli;
        this.snippets = new Snippets();
        this.tools = [
            { name: "list_licenses", description: "List licenses, newest first. Filter by status, product id or search text (key, customer).", inputSchema: { type: "object", properties: { status: { type: "string" }, product_id: { type: "integer" }, search: { type: "string" }, limit: { type: "integer", default: 25 } } } },
            { name: "get_license", description: "Get one license by id or full key, with product, customer, seats and expiry.", inputSchema: { type: "object", properties: { license: { type: "string" } }, required: ["license"] } },
            { name: "issue_license", description: "Issue a license for a product to a customer email. Creates the customer when the email is new.", inputSchema: { type: "object", properties: { product: { type: "string", description: "Product id or exact name" }, email: { type: "string" }, name: { type: "string" }, expires_at: { type: "string", description: "ISO date, empty for the product default" } }, required: ["product", "email"] } },
            { name: "set_license_status", description: "Change a license status, for example active, suspended or revoked.", inputSchema: { type: "object", properties: { license: { type: "string" }, status: { type: "string" } }, required: ["license", "status"] } },
            { name: "list_products", description: "List products.", inputSchema: { type: "object", properties: { search: { type: "string" } } } },
            { name: "create_product", description: "Create a product. duration 0 means lifetime licenses.", inputSchema: { type: "object", properties: { name: { type: "string" }, version: { type: "string" }, duration: { type: "integer" }, duration_unit: { type: "string", enum: ["days", "weeks", "months", "years"] } }, required: ["name"] } },
            { name: "list_customers", description: "Search customers by name, email or Discord id.", inputSchema: { type: "object", properties: { search: { type: "string" } } } },
            { name: "block_customer", description: "Block or unblock a customer. Blocked customers fail validation on every license.", inputSchema: { type: "object", properties: { customer: { type: "string", description: "Id, email or Discord id" }, blocked: { type: "boolean" } }, required: ["customer", "blocked"] } },
            { name: "list_access_rules", description: "List IP, device and country block or exclude rules.", inputSchema: { type: "object", properties: {} } },
            { name: "add_access_rule", description: "Block or exclude an IP or CIDR range, a device id or a two-letter country.", inputSchema: { type: "object", properties: { type: { type: "string", enum: ["ip", "device", "country"] }, value: { type: "string" }, mode: { type: "string", enum: ["block", "exclude"] }, note: { type: "string" } }, required: ["type", "value"] } },
            { name: "validate_license", description: "Validate a key exactly like a product would, without taking a seat.", inputSchema: { type: "object", properties: { key: { type: "string" }, product: { type: "string" }, hwid: { type: "string" } }, required: ["key"] } },
            { name: "sdk_snippet", description: "Code that adds a Kora license check to a project, with this server's address filled in.", inputSchema: { type: "object", properties: { language: { type: "string", enum: this.snippets.languages() }, product: { type: "string" } }, required: ["language", "product"] } }
        ];
    }

    start() {
        const rl = readline.createInterface({ input: process.stdin, terminal: false });
        rl.on("line", line => this.receive(line).catch(error => process.stderr.write(`${error.message}\n`)));
        return new Promise(resolve => rl.on("close", () => resolve(0)));
    }

    send(message) {
        process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
    }

    async receive(line) {
        if (!line.trim()) return;
        const message = JSON.parse(line);
        if (message.id === undefined || message.id === null) return;
        try {
            this.send({ id: message.id, result: await this.answer(message.method, message.params ? message.params : {}) });
        } catch (error) {
            this.send({ id: message.id, error: { code: error.code === "method" ? -32601 : -32603, message: error.message } });
        }
    }

    async answer(method, params) {
        switch (method) {
            case "initialize":
                return { protocolVersion: params.protocolVersion ? params.protocolVersion : "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "kora", version: this.cli.version }, instructions: "Kora is a license manager. Use these tools to manage licenses, products, customers and access rules on the signed-in Kora server, and sdk_snippet to add a license check to code. Confirm with the user before revoking or suspending licenses or blocking customers." };
            case "ping":
                return {};
            case "tools/list":
                return { tools: this.tools };
            case "tools/call":
                return this.call(params.name, params.arguments ? params.arguments : {});
            default:
                throw Object.assign(new Error(`Unknown method ${method}`), { code: "method" });
        }
    }

    async call(name, input) {
        try {
            return { content: [{ type: "text", text: JSON.stringify(await this.run(name, input), null, 2) }] };
        } catch (error) {
            return { content: [{ type: "text", text: error.message }], isError: true };
        }
    }

    async product(client, reference) {
        const direct = /^\d+$/.test(String(reference)) ? await client.send("GET", `/products/${reference}`) : null;
        if (direct && direct.status === 200) return direct.data;
        const rows = (await client.call("GET", `/products${client.query({ search: reference, limit: 50 })}`)).products;
        const found = rows.find(row => String(row.id) === String(reference) || row.name.toLowerCase() === String(reference).toLowerCase());
        if (!found) throw new Error(`No product named "${reference}".`);
        return found;
    }

    async run(name, input) {
        const client = this.cli.client();
        switch (name) {
            case "list_licenses":
                return (await client.call("GET", `/licenses${client.query({ status: input.status, product_id: input.product_id, search: input.search, limit: input.limit ? input.limit : 25 })}`)).licenses.map(row => ({ id: row.id, key: row.key, status: row.status, product: row.product_name, customer: row.customer_name, expires_at: row.expires_at, seats: row.seats }));
            case "get_license":
                return client.call("GET", `/licenses/${encodeURIComponent(input.license)}`);
            case "issue_license": {
                const product = await this.product(client, input.product);
                const email = String(input.email).toLowerCase();
                const existing = (await client.call("GET", `/customers${client.query({ search: email, limit: 5 })}`)).customers.find(row => row.email === email);
                const customer = existing ? existing : (await client.call("POST", "/customers", { name: input.name ? input.name : "", email })).customer;
                return (await client.call("POST", "/licenses", { product_id: product.id, customer_id: customer.id, ...(input.expires_at ? { expires_at: input.expires_at } : {}) })).license;
            }
            case "set_license_status": {
                const license = await client.call("GET", `/licenses/${encodeURIComponent(input.license)}`);
                return (await client.call("PATCH", `/licenses/${license.id}`, { status: input.status })).license;
            }
            case "list_products":
                return (await client.call("GET", `/products${client.query({ search: input.search, limit: 100 })}`)).products;
            case "create_product":
                return (await client.call("POST", "/products", input)).product;
            case "list_customers":
                return (await client.call("GET", `/customers${client.query({ search: input.search, limit: 50 })}`)).customers;
            case "block_customer": {
                const customer = await client.call("GET", `/customers/${encodeURIComponent(input.customer)}`);
                return (await client.call("PATCH", `/customers/${customer.id}`, { blocked: input.blocked === true })).customer;
            }
            case "list_access_rules":
                return (await client.call("GET", "/rules?limit=200")).rules;
            case "add_access_rule":
                return (await client.call("POST", "/rules", { mode: "block", ...input })).rule;
            case "validate_license":
                return (await client.send("POST", "/licenses/validate", { license_key: input.key, ...(input.product ? { product_name: input.product } : {}), ...(input.hwid ? { hwid: input.hwid } : {}) })).data;
            case "sdk_snippet":
                return this.snippets.get(input.language, client.url, input.product);
            default:
                throw new Error(`Unknown tool ${name}`);
        }
    }
}
