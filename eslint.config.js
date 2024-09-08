import pluginJs from "@eslint/js";
import pluginJsdoc from "eslint-plugin-jsdoc";
import pluginTs from "typescript-eslint";

export default pluginTs.config(
  pluginJs.configs.recommended,
  pluginJsdoc.configs["flat/recommended-typescript-error"],
  ...pluginTs.configs.strictTypeChecked,
  ...pluginTs.configs.stylisticTypeChecked,
  {
    rules: {
      "jsdoc/check-line-alignment": "error",
      "jsdoc/check-tag-names": [
        "error",
        { definedTags: ["id", "idiom", "instructions", "noid"] },
      ],
      "jsdoc/no-bad-blocks": "error",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/tag-lines": "off",
      "no-control-regex": "off",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/src/**/*.ts"],
    rules: {
      "@typescript-eslint/class-literal-property-style": "off",
      "@typescript-eslint/consistent-indexed-object-style": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "always" },
      ],
      "@typescript-eslint/no-explicit-any": ["error", { ignoreRestArgs: true }],
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/no-invalid-void-type": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: false },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-useless-constructor": "off",
      "@typescript-eslint/prefer-function-type": "off",
      "@typescript-eslint/prefer-promise-reject-errors": "off",
      "@typescript-eslint/restrict-plus-operands": [
        "error",
        { allowNumberAndString: true },
      ],
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/unbound-method": "off",
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
