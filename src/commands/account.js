import { Client, KoraError } from "../client.js";

export class AccountCommands {
    constructor(cli) {
        this.cli = cli;
    }

    names() {
        return ["login", "logout", "whoami", "accounts", "switch"];
    }

    help() {
        return [
            this.cli.out.bold("Accounts"),
            "  kora login [--url URL] [--token-stdin] [--name NAME]   Save an API token from the dashboard's API Tokens page",
            "  kora logout [NAME] [--all]                              Forget a saved account",
            "  kora whoami                                             The current account and what it can see",
            "  kora accounts                                           Every saved account",
            "  kora switch [NAME]                                      Pick the account commands use"
        ].join("\n");
    }

    async run(name, args, flags) {
        switch (name) {
            case "login":
                return this.login(flags);
            case "logout":
                return this.logout(args[0], flags);
            case "whoami":
                return this.whoami();
            case "accounts":
                return this.list();
            default:
                return this.switch(args[0]);
        }
    }

    async login(flags) {
        const url = await this.cli.need(flags.url ? flags.url : process.env.KORA_URL, "Kora API address (for example https://api.example.com): ");
        const token = flags["token-stdin"] === true ? await this.cli.stdin() : await this.cli.need(flags.token, "API token: ", true);
        const client = new Client(url.replace(/\/api\/v1\/?$/, ""), token);
        const page = await client.call("GET", "/licenses?limit=1");
        const name = flags.name ? flags.name : new URL(client.url).host;
        this.cli.accounts.add(name, client.url, token);
        if (this.cli.out.json) return this.cli.out.data({ account: name, url: client.url, licenses: page.total });
        this.cli.out.done(`Signed in to ${this.cli.out.bold(client.url)} as ${this.cli.out.bold(name)}. ${page.total} license(s) visible.`);
    }

    logout(name, flags) {
        if (flags.all === true) {
            this.cli.accounts.clear();
            return this.cli.out.done("Forgot every saved account.");
        }
        const account = this.cli.accounts.resolve(name ? name : flags.account);
        if (!account || account.name === "environment") throw new KoraError("No saved account to sign out of.", 0);
        this.cli.accounts.remove(account.name);
        this.cli.out.done(`Forgot ${account.name}.`);
    }

    async whoami() {
        const account = this.cli.accounts.resolve(this.cli.flags.account);
        if (!account) throw new KoraError("Not signed in. Run kora login.", 0);
        const client = this.cli.client();
        const [licenses, products, customers] = await Promise.all(["licenses", "products", "customers"].map(path => client.call("GET", `/${path}?limit=1`).then(page => page.total).catch(() => null)));
        if (this.cli.out.json) return this.cli.out.data({ account: account.name, url: account.url, licenses, products, customers });
        this.cli.out.pairs([["Account", this.cli.out.bold(account.name)], ["Server", account.url], ["Licenses", licenses === null ? this.cli.out.dim("no access") : licenses], ["Products", products === null ? this.cli.out.dim("no access") : products], ["Customers", customers === null ? this.cli.out.dim("no access") : customers]]);
    }

    list() {
        const data = this.cli.accounts.load();
        const rows = Object.entries(data.accounts).map(([name, account]) => ({ name, url: account.url, current: name === data.current }));
        if (this.cli.out.json) return this.cli.out.data(rows);
        this.cli.out.table(rows, [{ label: "", get: row => row.current ? this.cli.out.green("●") : " " }, { label: "Account", get: row => row.name }, { label: "Server", get: row => row.url }]);
    }

    async switch(name) {
        const data = this.cli.accounts.load();
        const names = Object.keys(data.accounts);
        if (names.length === 0) throw new KoraError("No saved accounts. Run kora login.", 0);
        const chosen = name ? name : names[Number(await this.cli.need(null, `${names.map((entry, index) => `  ${index + 1}. ${entry}${entry === data.current ? " (current)" : ""}`).join("\n")}\nAccount number: `)) - 1];
        if (!chosen) throw new KoraError("Pick one of the listed numbers.", 0);
        this.cli.accounts.use(chosen);
        this.cli.out.done(`Using ${chosen}.`);
    }
}
