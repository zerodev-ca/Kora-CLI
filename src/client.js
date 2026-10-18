export class KoraError extends Error {
    constructor(message, status, code = 1) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export class Client {
    constructor(url, token) {
        this.url = String(url).replace(/\/+$/, "");
        this.token = token;
    }

    async send(method, path, body, { auth = true } = {}) {
        const response = await fetch(`${this.url}/api/v1${path}`, {
            method,
            headers: { accept: "application/json", "content-type": "application/json", ...(auth && this.token ? { authorization: `Bearer ${this.token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(20000)
        }).catch(error => {
            throw new KoraError(`Could not reach ${this.url}: ${error.cause ? error.cause.message : error.message}`, 0, 2);
        });
        const text = await response.text();
        const data = text.startsWith("{") || text.startsWith("[") ? JSON.parse(text) : null;
        if (response.status >= 500) throw new KoraError(data && data.error ? data.error : `Kora answered with status ${response.status}`, response.status, 2);
        return { status: response.status, text, data, signature: response.headers.get("x-kora-signature") };
    }

    async call(method, path, body) {
        const reply = await this.send(method, path, body);
        if (reply.status === 401) throw new KoraError("This token was refused. Run kora login again.", 401);
        if (reply.status === 403) throw new KoraError(reply.data && reply.data.error ? reply.data.error : "This token is missing a scope for that.", 403);
        if (reply.status >= 400) throw new KoraError(reply.data && reply.data.error ? reply.data.error : `Kora answered with status ${reply.status}`, reply.status);
        return reply.data;
    }

    query(values) {
        const entries = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "");
        return entries.length > 0 ? `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))}` : "";
    }
}
