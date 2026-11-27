import tseslint from "typescript-eslint";

// Layer boundaries. Violations are lint errors.
// Bare package names go in `paths` (exact match); a bare "firebase" pattern would also match our ./firebase module.
const ADMIN_SDK = ["firebase-admin/*"];
const CLIENT_SDK = ["firebase/*", "@firebase/*"];
const SDK_PATHS = [
  { name: "firebase-admin", message: "The Admin SDK is server-only (server/firebase.ts)." },
  { name: "firebase", message: "Use @firebase/* in client/auth only." },
];

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-syntax": ["error", { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: "Raw HTML is forbidden (XSS). Render text through React." }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },
  {
    // Browser code: never the server or the Admin SDK. The Firebase client SDK only in client/auth.
    files: ["client/**/*.{ts,tsx}", "app/**/page.tsx", "app/**/layout.tsx"],
    ignores: ["client/auth/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: SDK_PATHS,
        patterns: [
          { group: ["@/server/**", "**/server/**", "!@/server/page-guards"], message: "Pages/client may only import @/server/page-guards from the server." },
          { group: [...ADMIN_SDK, ...CLIENT_SDK], message: "Firebase SDKs: Admin only in server/firebase.ts, client only in client/auth." },
        ],
      }],
    },
  },
  {
    files: ["client/auth/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: SDK_PATHS,
        patterns: [
          { group: ["@/server/**", "**/server/**"], message: "Client code may not import the server." },
          { group: ADMIN_SDK, message: "The Admin SDK is server-only." },
        ],
      }],
    },
  },
  {
    // Server: Admin SDK only through server/firebase.ts; never the client SDK or the client folder.
    files: ["server/**/*.ts"],
    ignores: ["server/firebase.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: SDK_PATHS,
        patterns: [
          { group: ["@/client/*", "**/client/**"], message: "Server may not import client code." },
          { group: [...ADMIN_SDK, ...CLIENT_SDK], message: "Use server/firebase.ts." },
        ],
      }],
    },
  },
);
