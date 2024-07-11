const queryCursorPosition = (
  input: NodeJS.ReadStream,
): Promise<{ row: number; col: number } | undefined> => {
  if (!input.isTTY) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    // Write the cursor position query.
    input.write("\x1B[6n");

    // Read the cursor position query response.
    input.once("data", (data: Buffer): void => {
      // eslint-disable-next-line no-control-regex
      const match = /\x1B\[(\d+);(\d+)R/.exec(data.toString());
      if (match !== null) {
        resolve({
          row: Number(match[1]),
          col: Number(match[2]),
        });
      } else {
        resolve(undefined);
      }
    });
  });
};

export { queryCursorPosition };
