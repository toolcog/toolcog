import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const spawnLoader = (): Promise<number> => {
  // Spawn a child process with the @toolcog/node/loader enabled.
  const child = spawn(
    process.execPath,
    [
      "--require",
      fileURLToPath(import.meta.resolve("./quiet.cjs")),
      "--loader",
      import.meta.resolve("./loader.js"),
      process.argv[1]!,
      "--loaded",
      ...process.argv.slice(2),
    ],
    {
      argv0: process.argv0,
      env: process.env,
      stdio: "inherit",
    },
  );

  // Return a promise that resolves when the child process exits.
  return new Promise((resolve) => {
    child.addListener("close", (exitCode) => resolve(exitCode ?? 1));
  });
};

export { spawnLoader };
