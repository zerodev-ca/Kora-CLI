export class Output {
    constructor(json) {
        this.json = json;
        this.color = process.stdout.isTTY === true && !process.env.NO_COLOR;
    }

    paint(code, text) {
        return this.color ? `\u001b[${code}m${text}\u001b[0m` : String(text);
    }

    bold(text) {
        return this.paint("1", text);
    }

    dim(text) {
        return this.paint("2", text);
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

    print(text = "") {
        process.stdout.write(`${text}\n`);
    }

    error(text) {
        process.stderr.write(`${this.red("✗")} ${text}\n`);
    }

    done(text) {
        if (!this.json) this.print(`${this.green("✓")} ${text}`);
    }

    data(value) {
        this.print(JSON.stringify(value, null, 2));
    }

    mask(key) {
        return String(key).split("-").map((part, index) => index === 0 ? part : part.replace(/./g, "X")).join("-");
    }

    tone(status) {
        if (["active", "valid", "completed", "issued", "exclude"].includes(status)) return this.green(status);
        if (["expired", "ignored"].includes(status)) return this.dim(status);
        return this.red(status);
    }

    table(rows, columns) {
        if (rows.length === 0) return this.print(this.dim("Nothing to show."));
        const cells = rows.map(row => columns.map(column => {
            const value = column.get(row);
            return value === null || value === undefined || value === "" ? "-" : String(value);
        }));
        const strip = text => text.replace(/\u001b\[[0-9;]*m/g, "");
        const widths = columns.map((column, index) => Math.max(column.label.length, ...cells.map(row => strip(row[index]).length)));
        this.print(columns.map((column, index) => this.dim(column.label.toUpperCase().padEnd(widths[index]))).join("  "));
        for (const row of cells) this.print(row.map((cell, index) => `${cell}${" ".repeat(widths[index] - strip(cell).length)}`).join("  "));
    }

    pairs(entries) {
        const width = Math.max(...entries.map(([label]) => label.length));
        for (const [label, value] of entries) this.print(`${this.dim(label.padEnd(width))}  ${value === null || value === undefined || value === "" ? "-" : value}`);
    }

    date(value) {
        return value ? new Date(value).toLocaleString() : "never";
    }
}
