import config from "@toolcog/config/eslint.config.js";

export default [
  ...config,
  {
    ignores: [
      "src/width.ts", // takes an eternity to lint
    ],
  },
];
