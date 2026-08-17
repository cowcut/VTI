import dotenv from "dotenv";
import mongoose from "mongoose";

const collectionNames = ["users", "conversations", "messages"] as const;
const confirmationText = "copy-local-ai_customer_support-to-atlas";

type MigrationEnvironment = {
  MONGODB_URI?: string;
  LOCAL_MONGODB_URI?: string;
  ATLAS_MONGODB_URI?: string;
  MIGRATION_CONFIRM?: string;
};

export const getMigrationConfig = (environment: MigrationEnvironment) => {
  const sourceUri = (environment.LOCAL_MONGODB_URI || environment.MONGODB_URI)?.trim();
  const destinationUri = environment.ATLAS_MONGODB_URI?.trim();

  if (!sourceUri) throw new Error("MONGODB_URI is required for the local source database");
  if (!destinationUri) throw new Error("ATLAS_MONGODB_URI is required for the Atlas destination database");
  if (sourceUri === destinationUri) throw new Error("Source and Atlas destination URIs must be different");
  if (environment.MIGRATION_CONFIRM !== confirmationText) {
    throw new Error(`Set MIGRATION_CONFIRM=${confirmationText} to replace Atlas collections`);
  }

  return { sourceUri, destinationUri };
};

export const migrateToAtlas = async (environment: MigrationEnvironment = process.env) => {
  const { sourceUri, destinationUri } = getMigrationConfig(environment);
  const source = await mongoose.createConnection(sourceUri).asPromise();
  const destination = await mongoose.createConnection(destinationUri).asPromise();

  try {
    const results: Record<string, number> = {};

    for (const name of collectionNames) {
      const documents = await source.db!.collection(name).find({}).toArray();
      await destination.db!.collection(name).deleteMany({});
      if (documents.length > 0) await destination.db!.collection(name).insertMany(documents);

      const destinationCount = await destination.db!.collection(name).countDocuments();
      if (destinationCount !== documents.length) {
        throw new Error(`Migration count mismatch for ${name}`);
      }
      results[name] = destinationCount;
    }

    return results;
  } finally {
    await Promise.all([source.close(), destination.close()]);
  }
};

const run = async () => {
  dotenv.config();
  dotenv.config({ path: ".env.migration" });

  const results = await migrateToAtlas();
  console.log(`Atlas migration completed: users=${results.users}, conversations=${results.conversations}, messages=${results.messages}`);
};

if (require.main === module) {
  run().catch((error: unknown) => {
    console.error("Atlas migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
