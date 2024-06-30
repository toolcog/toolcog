#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { rewriteDeps } from "./deps.cjs";

const transformPackageJson = (pkg) => {
  // Rewrite sub-package dependencies to outermost package.
  pkg = rewriteDeps(pkg);

  return pkg;
};

const program = new Command();

program.name("toolcog-config").description("toolcog configuration scripts");

program
  .command("prepack")
  .description("Run prepack script")
  .action(() => {
    const packagePath = path.resolve(process.cwd(), "package.json");
    const backupPath = path.resolve(process.cwd(), "package.json.backup");

    // Make a backup copy of the `package.json` file.
    fs.copyFileSync(packagePath, backupPath);

    // Load the original `package.json` file.
    const packageData = fs.readFileSync(packagePath, "utf8");
    const packageJson = JSON.parse(packageData);

    // Transform the parsed package configuration.
    const transformedPackageJson = transformPackageJson(packageJson);
    const transformedPackageData = JSON.stringify(
      transformedPackageJson,
      null,
      2,
    );

    // Write the transformed package configuration back to `package.json`.
    fs.writeFileSync(packagePath, transformedPackageData);
  });

program
  .command("postpack")
  .description("Run postpack script")
  .action(() => {
    const backupPath = path.resolve(process.cwd(), "package.json.backup");
    const packagePath = path.resolve(process.cwd(), "package.json");

    // Check if a backup `package.json` file exists.
    if (!fs.existsSync(backupPath)) {
      return;
    }

    // Restore the backup `package.json` file.
    fs.copyFileSync(backupPath, packagePath);
    // Remove the backup `package.json` file.
    fs.unlinkSync(backupPath);
  });

program.parse(process.argv);
