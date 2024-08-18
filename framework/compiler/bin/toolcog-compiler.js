#!/usr/bin/env node

import { runMain } from "citty";
import { compilerCommand, version } from "@toolcog/compiler/cli";

await runMain({
  ...compilerCommand,
  meta: {
    name: "toolcog-compiler",
    version,
    description: compilerCommand.meta.description,
  },
});
