const sdk = require('node-appwrite');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  RETAINED_EARNINGS_COLLECTION_ID,
  VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_API_KEY,
  VITE_APPWRITE_DATABASE_ID
} = process.env;

const endpoint = APPWRITE_ENDPOINT || VITE_APPWRITE_ENDPOINT;
const projectId = APPWRITE_PROJECT_ID || VITE_APPWRITE_PROJECT_ID;
const apiKey = APPWRITE_API_KEY || VITE_APPWRITE_API_KEY;
const databaseId = DATABASE_ID || VITE_APPWRITE_DATABASE_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents');
  process.exit(1);
}

const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

async function ensureRetainedEarningsCollection() {
  const collectionId = RETAINED_EARNINGS_COLLECTION_ID || sdk.ID.unique();
  const name = 'retained_earnings';
  const permissions = [
    sdk.Permission.read(sdk.Role.any()),
    sdk.Permission.write(sdk.Role.any())
  ];

  const existing = await databases.listCollections(databaseId);
  const found = existing.collections.find((col) => col.name === name || col.$id === collectionId);
  if (found) {
    console.log(`Retained earnings collection already exists: ${found.$id}`);
    return found.$id;
  }

  const created = await databases.createCollection(
    databaseId,
    collectionId,
    name,
    permissions
  );

  return created.$id;
}

async function createAttributes(collectionId) {
  const attrs = [
    databases.createIntegerAttribute(databaseId, collectionId, 'year', true),
    databases.createFloatAttribute(databaseId, collectionId, 'percentage', true),
    databases.createDatetimeAttribute(databaseId, collectionId, 'createdAt', false),
    databases.createStringAttribute(databaseId, collectionId, 'notes', 500, false)
  ];

  for (const action of attrs) {
    try {
      await action;
    } catch (error) {
      if (String(error.message || '').includes('already exists')) {
        continue;
      }
      throw error;
    }
  }
}

async function createIndexes(collectionId) {
  const indexes = [
    databases.createIndex(databaseId, collectionId, 'idx_year', 'unique', ['year'])
  ];

  for (const action of indexes) {
    try {
      await action;
    } catch (error) {
      if (String(error.message || '').includes('already exists')) {
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const collectionId = await ensureRetainedEarningsCollection();
  await createAttributes(collectionId);
  await createIndexes(collectionId);
  console.log(`Retained earnings collection ready: ${collectionId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
