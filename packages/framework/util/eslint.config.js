import config from "../../../eslint.config.js";

export default [
  ...config,
  {
    ignores: [
      "tty/src/width.ts", // takes an eternity to lint
    ],
  },
];
