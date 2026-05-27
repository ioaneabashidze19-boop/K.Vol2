/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

// Read commit message from the file argument provided by Husky
const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error("❌ Error: Path to commit message file is missing.");
  process.exit(1);
}

if (!fs.existsSync(commitMsgFile)) {
  console.error(`❌ Error: Commit message file not found at ${commitMsgFile}`);
  process.exit(1);
}

const commitMsg = fs.readFileSync(commitMsgFile, "utf8").trim();

// Ignore merge commits or revert commits automatically
if (commitMsg.startsWith("Merge ") || commitMsg.startsWith("Revert ")) {
  process.exit(0);
}

// Conventional commit message regex pattern
// Examples:
// - feat(auth): add stripe integration
// - fix: resolve routing bug
const commitPattern =
  /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\([a-zA-Z0-9\-_\s]+\))?!?: .{5,}/i;

if (!commitPattern.test(commitMsg)) {
  console.error("\n❌ INVALID COMMIT MESSAGE FORMAT!");
  console.error("------------------------------------------------------------------");
  console.error("Your commit message does not match the Conventional Commits format:");
  console.error("  <type>(<scope>): <subject>");
  console.error("\nAllowed Types:");
  console.error("  feat     : A new feature");
  console.error("  fix      : A bug fix");
  console.error("  docs     : Documentation changes only");
  console.error("  style    : Formatting, white-space, semi-colons (no code changes)");
  console.error("  refactor : A code change that neither fixes a bug nor adds a feature");
  console.error("  perf     : A code change that improves performance");
  console.error("  test     : Adding missing/updating existing tests");
  console.error("  chore    : Tooling, dependency, or configuration changes");
  console.error("  ci       : CI workflow or infrastructure scripts");
  console.error("  build    : Build configuration rules (e.g. tsconfig, npm package)");
  console.error("\nExample commit messages:");
  console.error("  feat(auth): add Clerk OAuth integration");
  console.error("  fix(db): correct profiles table foreign key");
  console.error("  chore: update dependencies and husky configurations");
  console.error("\nMessage length must be at least 5 characters after the colon.");
  console.error("------------------------------------------------------------------\n");
  process.exit(1);
}

console.log("✅ Commit message format is valid.");
process.exit(0);
