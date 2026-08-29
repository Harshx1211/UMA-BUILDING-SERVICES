// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // services/report-generator is a standalone Node service (its own
    // package.json, tsconfig, and typecheck/smoketest scripts) — same
    // reasoning as excluding supabase/functions/*: a separate runtime with
    // no relation to Expo's React Native rules, and its dist/ is compiled
    // output, not source.
    ignores: ['dist/*', 'supabase/functions/*', 'services/report-generator/**'],
  },
]);
