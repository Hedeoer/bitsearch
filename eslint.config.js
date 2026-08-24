import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "data/**", ".workflow/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: [
      "src/web/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
    ],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      // 存量代码迁移期降级:effect 内同步 setState 的重构尚未完成
      "react-hooks/set-state-in-effect": "warn",
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    files: [
      "src/server/**/*.ts",
      "src/shared/**/*.ts",
      "*.config.ts",
      "*.config.js",
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["scripts/**/*.ts", "tests/**/*.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
