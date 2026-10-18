// La misma revisión que hace community.obsidian.md (configuración recomendada del plugin oficial de ESLint).
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["main.js", "node_modules/**", "test/**", "demo-vault/**", "docs/**", "*.mjs"] },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ["eslint.config.*"] } },
    },
  },
]);
