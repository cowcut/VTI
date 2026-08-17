const test = require("node:test");
const assert = require("node:assert/strict");

const { getMigrationConfig } = require("../../dist/scripts/migrate-to-atlas.js");

test("Atlas migration requires distinct local and Atlas MongoDB URIs plus explicit confirmation", () => {
  assert.throws(() => getMigrationConfig({}), /MONGODB_URI/);
  assert.throws(
    () => getMigrationConfig({ MONGODB_URI: "mongodb://127.0.0.1:27017/ai_customer_support", ATLAS_MONGODB_URI: "mongodb://127.0.0.1:27017/ai_customer_support", MIGRATION_CONFIRM: "copy-local-ai_customer_support-to-atlas" }),
    /must be different/,
  );
  assert.throws(
    () => getMigrationConfig({ MONGODB_URI: "mongodb://127.0.0.1:27017/ai_customer_support", ATLAS_MONGODB_URI: "mongodb+srv://atlas.example/ai_customer_support" }),
    /MIGRATION_CONFIRM/,
  );
  assert.deepEqual(
    getMigrationConfig({
      MONGODB_URI: "mongodb://127.0.0.1:27017/ai_customer_support",
      ATLAS_MONGODB_URI: "mongodb+srv://atlas.example/ai_customer_support",
      MIGRATION_CONFIRM: "copy-local-ai_customer_support-to-atlas",
    }),
    {
      sourceUri: "mongodb://127.0.0.1:27017/ai_customer_support",
      destinationUri: "mongodb+srv://atlas.example/ai_customer_support",
    },
  );
});

test("Atlas migration uses an explicit local URI when backend config already points to Atlas", () => {
  assert.deepEqual(
    getMigrationConfig({
      MONGODB_URI: "mongodb+srv://atlas.example/ai_customer_support",
      LOCAL_MONGODB_URI: "mongodb://127.0.0.1:27017/ai_customer_support",
      ATLAS_MONGODB_URI: "mongodb+srv://atlas.example/ai_customer_support",
      MIGRATION_CONFIRM: "copy-local-ai_customer_support-to-atlas",
    }),
    {
      sourceUri: "mongodb://127.0.0.1:27017/ai_customer_support",
      destinationUri: "mongodb+srv://atlas.example/ai_customer_support",
    },
  );
});
