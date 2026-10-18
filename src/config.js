import fs from "fs";
import os from "os";
import path from "path";

export class Accounts {
    constructor() {
        this.file = process.env.KORA_CONFIG ? process.env.KORA_CONFIG : path.join(this.folder(), "config.json");
    }

    folder() {
        switch (process.platform) {
            case "darwin":
                return path.join(os.homedir(), "Library", "Application Support", "kora");
            case "win32":
                return path.join(process.env.APPDATA ? process.env.APPDATA : path.join(os.homedir(), "AppData", "Roaming"), "kora");
            default:
                return path.join(process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : path.join(os.homedir(), ".config"), "kora");
        }
    }

    load() {
        if (!fs.existsSync(this.file)) return { current: null, accounts: {} };
        return JSON.parse(fs.readFileSync(this.file, "utf8"));
    }

    save(data) {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, `${JSON.stringify(data, null, 4)}\n`, { mode: 0o600 });
        fs.chmodSync(this.file, 0o600);
    }

    add(name, url, token) {
        const data = this.load();
        data.accounts[name] = { url: url.replace(/\/+$/, "").replace(/\/api\/v1$/, ""), token };
        data.current = name;
        this.save(data);
        return data.accounts[name];
    }

    remove(name) {
        const data = this.load();
        delete data.accounts[name];
        if (data.current === name) data.current = Object.keys(data.accounts).length > 0 ? Object.keys(data.accounts)[0] : null;
        this.save(data);
    }

    clear() {
        this.save({ current: null, accounts: {} });
    }

    use(name) {
        const data = this.load();
        if (!Object.hasOwn(data.accounts, name)) throw new Error(`No saved account named "${name}". Run kora accounts to see them.`);
        data.current = name;
        this.save(data);
    }

    resolve(name) {
        if (process.env.KORA_TOKEN && process.env.KORA_URL) return { name: "environment", url: process.env.KORA_URL.replace(/\/+$/, ""), token: process.env.KORA_TOKEN };
        const data = this.load();
        const chosen = name ? name : data.current;
        if (!chosen || !Object.hasOwn(data.accounts, chosen)) return null;
        return { name: chosen, ...data.accounts[chosen] };
    }
}
