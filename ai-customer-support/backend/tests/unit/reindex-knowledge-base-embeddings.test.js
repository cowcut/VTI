const test = require("node:test");
const assert = require("node:assert/strict");
const packageJson = require("../../package.json");

const { mapWithConcurrency } = require("../../dist/scripts/reindex-knowledge-base-embeddings.js");

test("a compiled explicit command runs the embedding reindex", () => {
  assert.equal(packageJson.scripts["reindex:knowledge-base-embeddings"], "npm run build && node dist/scripts/reindex-knowledge-base-embeddings.js");
});

test("reindex work never exceeds its configured concurrency", async () => {
  let active = 0;
  let peak = 0;
  const output = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(output, [2, 4, 6, 8, 10]);
  assert.equal(peak, 2);
});
