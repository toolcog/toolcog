#!/usr/bin/env node

import { cli } from "#cli";

await cli().parseAsync(process.argv);
