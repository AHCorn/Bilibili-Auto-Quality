// 打包 src/ 为根目录单文件用户脚本
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const OUT_FILE = "Bilibili-Auto-Quality.user.js";

function fail(message) {
    console.error(`构建中止：${message}`);
    process.exit(1);
}

function readText(path) {
    try {
        return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    } catch (err) {
        fail(`读取 ${path} 失败：${err.message}`);
    }
}

function stripCommentsAndStrings(code) {
    let out = "";
    let i = 0;
    const end = code.length;
    while (i < end) {
        const ch = code[i];
        if (ch === "/" && code[i + 1] === "/") {
            while (i < end && code[i] !== "\n") i++;
        } else if (ch === "/" && code[i + 1] === "*") {
            i += 2;
            while (i < end && !(code[i] === "*" && code[i + 1] === "/")) i++;
            i += 2;
            out += " ";
        } else if (ch === "\"" || ch === "'" || ch === "`") {
            i++;
            while (i < end && code[i] !== ch) {
                if (code[i] === "\\") i++;
                i++;
            }
            i++;
            out += " ";
        } else {
            out += ch;
            i++;
        }
    }
    return out;
}

function collectGrants(meta) {
    const grants = new Set();
    for (const line of meta.split(/\r\n|\r|\n/)) {
        const m = /^\/\/\s*@grant\s+(\S+)\s*$/.exec(line);
        if (m) grants.add(m[1]);
    }
    return grants;
}

function checkGrants(grants, code) {
    const called = new Set(stripCommentsAndStrings(code).match(/\b(?:GM_\w+|unsafeWindow)\b/g) ?? []);
    const missing = [...called].filter(api => !grants.has(api)).sort();
    if (missing.length) {
        fail(`src/meta.txt 缺少 @grant 声明：${missing.join("、")}`);
    }
}

const pkg = JSON.parse(readText("package.json"));
const version = typeof pkg.version === "string" ? pkg.version.trim() : "";
if (!version) {
    fail("package.json 缺少有效的 version 字段");
}

const meta = readText("src/meta.txt")
    .trimEnd()
    .replace(/^(\/\/[^\S\n]*@version[^\S\n]+)\S+[^\S\n]*$/m, `$1${version}`);
const grants = collectGrants(meta);

const result = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "iife",
    target: "es2020",
    charset: "utf8",
    write: false,
    legalComments: "none",
}).catch(err => fail(`esbuild 打包失败：${err.message}`));

let code = result.outputFiles[0].text;
if (!code.startsWith('"use strict";')) {
    code = '"use strict";\n' + code;
}

checkGrants(grants, code);
writeFileSync(OUT_FILE, meta + "\n\n" + code);
console.log(`built ${OUT_FILE} (@version ${version})`);
