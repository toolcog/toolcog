import { defineCommand } from "citty";
import { generateCommand } from "./generate.ts";

const compilerCommand = defineCommand({
  meta: {
    name: "compile",
    description: "Toolcog compiler",
  },
  subCommands: {
    generate: generateCommand,
  },
});

export { compilerCommand };
