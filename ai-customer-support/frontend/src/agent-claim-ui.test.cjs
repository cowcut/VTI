const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("unassigned human tickets expose the agent claim action", () => {
  const app = fs.readFileSync(path.join(__dirname, "App.tsx"), "utf8");
  assert.match(app, /p\.active\.mode === 'ai' \|\| !p\.active\.assignedAgent/);
});
