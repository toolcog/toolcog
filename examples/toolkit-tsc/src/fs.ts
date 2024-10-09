import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { defineTool } from "@toolcog/core";

/**
 * Creates a directory on the local file system.
 *
 * @idiom Create a directory on the local file system.
 * @param path - The path of the directory to create.
 * @param options - Directory creation options.
 * @returns `undefined` if the directory was created, or an error object.
 */
export const makeDirectory = defineTool(
  async (
    path: string,
    options?: {
      // Whether to create parent directories if they don't exist.
      recursive?: boolean;
    },
  ): Promise<undefined | Error> => {
    try {
      await mkdir(resolveFile(path), options);
    } catch (error) {
      return error as Error;
    }
  },
);

/**
 * Lists the files in a directory on the local file system.
 *
 * @idiom List files in a directory on the local file system.
 * @param path - The path of the directory to list files from.
 * @returns An array of file names in the directory, or an error object.
 */
export const listDirectory = defineTool(
  async (path: string): Promise<string[] | Error> => {
    const options = { withFileTypes: true } as const;
    try {
      return (await readdir(resolveFile(path), options)).map(
        (entry) => entry.name + (entry.isDirectory() ? "/" : ""),
      );
    } catch (error) {
      return error as Error;
    }
  },
);

/**
 * Reads the contents of a text file from the local file system.
 *
 * @idiom Read a text file from the local file system.
 * @param path - The path to the file to read.
 * @returns The contents of the file, or an error object.
 */
export const readTextFile = defineTool(
  async (path: string): Promise<string | Error> => {
    try {
      return await readFile(resolveFile(path), "utf-8");
    } catch (error) {
      return error as Error;
    }
  },
);

/**
 * Writes text to a file on the local file system.
 *
 * @idiom Write text to a file on the local file system.
 * @param path - The path to the file to write.
 * @param text - The text to write to the file.
 * @returns `undefined` if the file was written, or an error object.
 */
export const writeTextFile = defineTool(
  async (path: string, text: string): Promise<undefined | Error> => {
    try {
      await writeFile(resolveFile(path), text);
    } catch (error) {
      return error as Error;
    }
  },
);

/**
 * Resolves a file path on the local file system. Supports the `~` alias for
 * home directories.
 *
 * @param path - The path to resolve.
 * @returns The resolved path.
 */
const resolveFile = (path: string): string => {
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  } else {
    return resolve(path);
  }
};
