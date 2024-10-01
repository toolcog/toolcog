#!/usr/bin/env node

import { resolve as resolvePath } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

const packageJsonFile = resolvePath("./package.json");
const packageJson = JSON.parse(await readFile(packageJsonFile, "utf-8"));

let packageInfo = "";
packageInfo += `const version = ${JSON.stringify(packageJson.version)};\n`;
packageInfo += "\n";
packageInfo += "export { version };\n";

const packageInfoFile = resolvePath("./src/package-info.ts");
await writeFile(packageInfoFile, packageInfo, "utf-8");
