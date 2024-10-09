import {
  makeDirectory,
  listDirectory,
  readTextFile,
  writeTextFile,
} from "./fs.js";

// Export each individual tool for a la carte use.
export { makeDirectory, listDirectory, readTextFile, writeTextFile };

/**
 * An example toolkit with LLM tools for interacting with the local file system.
 */
const toolkit = {
  name: "@example/toolkit-tsc",
  version: "0.0.1",
  tools: [makeDirectory, listDirectory, readTextFile, writeTextFile],
} as const;

// Make this package a toolkit module by exporting a default toolkit.
export default toolkit;
