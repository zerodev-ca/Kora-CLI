export class Snippets {
    languages() {
        return ["node", "python", "java", "fivem", "dotnet", "php", "go", "rust"];
    }

    get(language, url, product) {
        switch (language) {
            case "node":
                return { install: "npm install @zerodev-ca/kora", code: `import { Client } from "@zerodev-ca/kora";\n\nconst kora = new Client({ url: "${url}", product: "${product}", publicKey: process.env.KORA_PUBLIC_KEY });\n\nconst result = await kora.activate(licenseKey, undefined, { hwid: machineId });\nif (!result.valid) throw new Error(result.message);` };
            case "python":
                return { install: "pip install zerodev-kora", code: `import os\nfrom kora import Client\n\nkora = Client("${url}", product="${product}", public_key=os.environ["KORA_PUBLIC_KEY"])\n\nresult = kora.activate(license_key, hwid=machine_id)\nif not result.valid:\n    raise SystemExit(result.message)` };
            case "java":
                return { install: "implementation(\"ca.zerodev:kora-java:3.1.0\")", code: `KoraClient kora = new KoraClient.Builder()\n    .url("${url}")\n    .product("${product}")\n    .publicKey(System.getenv("KORA_PUBLIC_KEY"))\n    .build();\n\nKoraResponse result = kora.activate(licenseKey, Map.of("hwid", machineId));\nif (!result.isValid()) {\n    throw new IllegalStateException(result.getMessage());\n}` };
            case "fivem":
                return { install: "ensure kora-fivem", code: `local config = { url = "${url}", product = "${product}", fields = { hwid = GetConvar("sv_hostname", "") } }\n\nexports["kora-fivem"]:activate(config, GetConvar("license_key", ""), function(valid, data)\n    if not valid then\n        print("^1" .. data.message .. "^7")\n        StopResource(GetCurrentResourceName())\n    end\nend)` };
            case "dotnet":
                return { install: "dotnet add package ZeroDev.Kora", code: `using Kora;\n\nvar kora = new KoraClient("${url}", product: "${product}", publicKey: Environment.GetEnvironmentVariable("KORA_PUBLIC_KEY"));\n\nvar result = await kora.ActivateAsync(licenseKey, fields: new() { ["hwid"] = machineId });\nif (!result.Valid) throw new Exception(result.Message);` };
            case "php":
                return { install: "composer require zerodev/kora", code: `use ZeroDev\\Kora\\Client;\n\n$kora = new Client("${url}", product: "${product}", publicKey: getenv("KORA_PUBLIC_KEY"));\n\n$result = $kora->activate($licenseKey, ["hwid" => $machineId]);\nif (!$result["valid"]) {\n    exit($result["message"]);\n}` };
            case "go":
                return { install: "go get github.com/zerodev-ca/Kora-SDKs/packages/go", code: `client := kora.New(kora.Options{URL: "${url}", Product: "${product}", PublicKey: os.Getenv("KORA_PUBLIC_KEY")})\n\nresult, err := client.Activate(context.Background(), licenseKey, map[string]string{"hwid": machineID})\nif err != nil {\n    log.Fatal(err)\n}\nif !result.Valid {\n    log.Fatal(result.Message)\n}` };
            case "rust":
                return { install: "cargo add zerodev-kora", code: `let kora = kora::Client::new("${url}").product("${product}").public_key(std::env::var("KORA_PUBLIC_KEY")?);\n\nlet result = kora.activate(&license_key, &[("hwid", machine_id.as_str())])?;\nif !result.valid {\n    return Err(result.message.into());\n}` };
            default:
                throw new Error(`No snippet for ${language}. Pick one of ${this.languages().join(", ")}.`);
        }
    }
}
