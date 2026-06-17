import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

const allowedDirective =
  /^(eslint|global|exported|prettier|@ts-|ts-|vite-ignore|webpack|c8|v8|istanbul)/;

const docBlocksOnly = {
  meta: {
    type: "problem",
    docs: { description: "Only /** */ doc blocks are allowed; no inline or line comments." },
    schema: []
  },
  create(context) {
    const source = context.sourceCode;

    return {
      Program() {
        for (const comment of source.getAllComments()) {
          if (allowedDirective.test(comment.value.trim())) {
            continue;
          }

          const isDocBlock = comment.type === "Block" && comment.value.startsWith("*");

          if (!isDocBlock) {
            context.report({
              loc: comment.loc,
              message: "Only /** */ doc blocks are allowed; remove inline and line comments."
            });
          }
        }
      }
    };
  }
};

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/vendor/**",
      "**/*.d.ts",
      "packages/site/README.md",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "doc-blocks-only": docBlocksOnly } } },
    rules: {
      "no-inline-comments": "error",
      "local/doc-blocks-only": "error",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
    }
  },
  {
    files: [
      "packages/core/**/*.ts",
      "packages/mcp/**/*.ts",
      "packages/watcher/**/*.ts",
      "e2e/**/*.ts",
      "**/*.mjs",
      "**/scripts/**"
    ],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    files: ["packages/site/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
);
