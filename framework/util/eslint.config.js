import config from "../../eslint.config.js";

export default [
  ...config,
  {
    ignores: [
      "src/tty/width.ts", // takes an eternity to lint
    ],
  },
];
