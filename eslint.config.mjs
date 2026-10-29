import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        rules: {
            "no-empty": ["error", { allowEmptyCatch: true }],
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/ban-ts-comment": "error",
        },
    },
    {
        files: ["build.mjs"],
        languageOptions: {
            globals: { console: "readonly", process: "readonly" },
        },
    },
    { ignores: ["node_modules/", "tests/", "发布计划/", ".cursor/", "*.user.js", "eslint.config.mjs"] },
);
