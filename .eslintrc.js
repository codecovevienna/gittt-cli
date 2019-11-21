module.exports = {
  env: {
    "node": true,
    "commonjs": true,
    "es6": true
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "mocha"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:mocha/recommended"
  ],
  parserOptions: {
    ecmaVersion: 6,
    project: "./tsconfig.json",
    sourceType: "module"
  },
  rules: {
    "no-case-declarations": 1,
    "@typescript-eslint/interface-name-prefix": 0
  },
  overrides: [
    {
      "files": ["*.test.ts"],
      "rules": {
        "no-undef": 0,
        "@typescript-eslint/no-explicit-any": 0
      }
    }
  ]
}
