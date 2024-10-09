import eslint from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  jsdoc.configs["flat/recommended-typescript"],
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      "jsdoc/check-line-alignment": "warn",
      "jsdoc/check-tag-names": [
        "warn",
        {
          definedTags: [
            "id",
            "idiom",
            "instructions",
            "noid",
            "typeParam",
            "value",
          ],
        },
      ],
      "jsdoc/tag-lines": "off",
    },
  },
  {
    files: ["**/src/**/*.ts"],
    rules: {},
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
