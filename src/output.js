export class Output {
    constructor(json) {
        this.json = json;
        this.color = process.stdout.isTTY === true && !process.env.NO_COLOR;
        this.tones = { active: "green", valid: "green", completed: "green", issued: "green", enabled: "green", exclude: "green", success: "green", suspended: "yellow", pending: "yellow", disputed: "yellow", block: "red", blocked: "red", revoked: "red", refunded: "red", rejected: "red", failed: "red", expired: "dim", ignored: "dim", disabled: "dim", existing: "dim" };
    }

    paint(code, text) {
        return this.color ? `\u001b[${code}m${text}\u001b[0m` : String(text);
    }

    strip(text) {
        return String(text).replace(/\u001b\[[0-9;]*m/g, "");
    }

    bold(text) {
        return this.paint("1", text);
    }

    dim(text) {
        return this.paint("2", text);
    }

    accent(text) {
        return this.paint("38;5;78", text);
    }

    green(text) {
        return this.paint("32", text);
    }

    red(text) {
        return this.paint("31", text);
    }

    yellow(text) {
        return this.paint("33", text);
    }

    cyan(text) {
        return this.paint("36", text);
    }

    badge(text, ok) {
        return this.color ? this.paint(ok ? "1;30;42" : "1;97;41", ` ${text.replace(/_/g, " ")} `) : `[${text}]`;
    }

    print(text = "") {
        process.stdout.write(`${text}\n`);
    }

    error(text) {
        process.stderr.write(`${this.paint("1;31", "error")}${this.dim(":")} ${this.commands(text)}\n`);
    }

    done(text) {
        if (!this.json) this.print(`${this.green("✓")} ${this.commands(text)}`);
    }

    commands(text) {
        return String(text).replace(/\bkora [a-z-]+( [a-z-]+)?/g, command => this.cyan(command));
    }

    title(text) {
        return this.paint("1;38;5;78", text);
    }

    heading(text) {
        this.print();
        this.print(this.title(text));
    }

    data(value) {
        this.print(JSON.stringify(value, null, 2));
    }

    mask(key) {
        return String(key).split("-").map((part, index) => index === 0 ? this.bold(part) : this.dim(part.replace(/./g, this.color ? "•" : "X"))).join(this.dim("-"));
    }

    key(key, reveal) {
        return reveal ? this.bold(key) : this.mask(key);
    }

    tone(status) {
        const color = this.tones[status];
        const dot = this.color ? "● " : "";
        if (!color) return `${dot}${status}`;
        return this[color](`${dot}${status}`);
    }

    result(code) {
        return code === "valid" ? this.tone(code) : this.red(`${this.color ? "● " : ""}${code}`);
    }

    blank(value) {
        return value === null || value === undefined || value === "";
    }

    table(rows, columns, gap = true) {
        if (gap) this.print();
        if (rows.length === 0) return this.print(`  ${this.dim("Nothing to show.")}`);
        const cells = rows.map(row => columns.map(column => {
            const value = column.get(row);
            return this.blank(value) ? this.dim("-") : String(value);
        }));
        const widths = columns.map((column, index) => Math.max(column.label.length, ...cells.map(row => this.strip(row[index]).length)));
        const pad = (cell, index) => `${cell}${" ".repeat(widths[index] - this.strip(cell).length)}`;
        this.print(`  ${columns.map((column, index) => this.bold(pad(column.label, index))).join("   ")}`.trimEnd());
        this.print(`  ${this.dim("─".repeat(widths.reduce((sum, width) => sum + width, 0) + (widths.length - 1) * 3))}`);
        for (const row of cells) this.print(`  ${row.map(pad).join("   ")}`.trimEnd());
    }

    count(shown, total, noun) {
        if (this.json) return;
        this.print();
        this.print(this.dim(total > shown ? `  ${shown} of ${total} ${noun}. Use --limit or -s to narrow it.` : `  ${total} ${noun}`));
    }

    pairs(entries) {
        const width = Math.max(...entries.map(([label]) => label.length));
        for (const [label, value] of entries) this.print(`  ${this.dim(label.padEnd(width))}   ${this.blank(value) ? this.dim("-") : value}`);
    }

    date(value) {
        if (!value) return this.dim("never");
        return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }

    day(value) {
        if (!value) return this.dim("never");
        return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
    }

    ago(value) {
        if (!value) return this.dim("never");
        const seconds = Math.round((Date.now() - Date.parse(value)) / 1000);
        const step = [{ limit: 60, unit: "s", size: 1 }, { limit: 3600, unit: "m", size: 60 }, { limit: 86400, unit: "h", size: 3600 }, { limit: 2592000, unit: "d", size: 86400 }].find(entry => Math.abs(seconds) < entry.limit);
        if (!step) return this.day(value);
        return `${Math.floor(seconds / step.size)}${step.unit} ago`;
    }

    syntax(usage) {
        return usage.replace(/^kora\b|(?<![a-z])--?[a-z][a-z-]*|\b[A-Z][A-Z_]*\b|[[\]()|]/g, token => {
            if (token === "kora") return this.dim(token);
            if (token.startsWith("-")) return this.cyan(token);
            if (/^[A-Z]/.test(token)) return this.yellow(token);
            return this.dim(token);
        });
    }

    command(usage) {
        const words = usage.split(" ");
        if (words[0] !== "kora") return usage;
        const taken = [];
        for (const word of words.slice(1)) {
            if (!/^[a-z][a-z-]*$/.test(word) && word !== "|") break;
            taken.push(word);
        }
        return taken.join(" ").replace(/ \| /g, "|");
    }

    overview(sections) {
        const width = Math.max(...sections.flatMap(section => section.rows.map(([usage]) => this.command(usage).length)));
        return sections.map(section => [this.title(section.title), ...section.rows.map(([usage, description]) => `  ${this.command(usage).startsWith("-") ? this.cyan(this.command(usage).padEnd(width)) : this.command(usage).padEnd(width)}   ${this.dim(description)}`)].join("\n")).join("\n\n");
    }

    usage(section) {
        return [
            this.title(section.title),
            "",
            ...section.rows.flatMap(([usage, description]) => [`  ${this.syntax(usage)}`, `      ${this.dim(description)}`, ""]),
            ...(section.note ? [`  ${this.dim(section.note)}`] : [])
        ].join("\n").trimEnd();
    }
}
