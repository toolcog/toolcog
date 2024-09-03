import pluginAstro from "eslint-plugin-astro";
import config from "../eslint.config.js";

export default [
  ...config,
  ...pluginAstro.configs["flat/recommended"],
];
