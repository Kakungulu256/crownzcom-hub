const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_API_KEY,
  VITE_APPWRITE_DATABASE_ID
} = process.env;

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
};

const envPath = path.resolve(__dirname, '..', '.env');
const fileEnv = parseEnvFile(envPath);

const endpoint = APPWRITE_ENDPOINT || VITE_APPWRITE_ENDPOINT || fileEnv.VITE_APPWRITE_ENDPOINT;
const projectId = APPWRITE_PROJECT_ID || VITE_APPWRITE_PROJECT_ID || fileEnv.VITE_APPWRITE_PROJECT_ID;
const apiKey = APPWRITE_API_KEY || VITE_APPWRITE_API_KEY || fileEnv.VITE_APPWRITE_API_KEY;
const databaseId = DATABASE_ID || VITE_APPWRITE_DATABASE_ID || fileEnv.VITE_APPWRITE_DATABASE_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents');
  process.exit(1);
}

const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

async function ensureCollection({ name, id }) {
  const existing = await databases.listCollections(databaseId);
  const found = existing.collections.find((col) => col.name === name || col.$id === id);
  if (found) {
    console.log(`${name} already exists: ${found.$id}`);
    return found.$id;
  }

  const permissions = [
    sdk.Permission.read(sdk.Role.any()),
    sdk.Permission.write(sdk.Role.any())
  ];

  const created = await databases.createCollection(
    databaseId,
    id || sdk.ID.unique(),
    name,
    permissions
  );
  console.log(`${name} created: ${created.$id}`);
  return created.$id;
}

async function createAttributes(collectionId, actions) {
  for (const action of actions) {
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

async function createIndexes(collectionId, actions) {
  for (const action of actions) {
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

async function setupLedgerEntries() {
  const collectionId = await ensureCollection({ name: 'ledger_entries' });
  await createAttributes(collectionId, [
    databases.createStringAttribute(databaseId, collectionId, 'type', 50, true),
    databases.createIntegerAttribute(databaseId, collectionId, 'amount', true),
    databases.createStringAttribute(databaseId, collectionId, 'memberId', 100, false),
    databases.createStringAttribute(databaseId, collectionId, 'loanId', 100, false),
    databases.createStringAttribute(databaseId, collectionId, 'month', 20, false),
    databases.createIntegerAttribute(databaseId, collectionId, 'year', false),
    databases.createDatetimeAttribute(databaseId, collectionId, 'createdAt', false),
    databases.createStringAttribute(databaseId, collectionId, 'notes', 500, false)
  ]);
  await createIndexes(collectionId, [
    databases.createIndex(databaseId, collectionId, 'idx_type', 'key', ['type']),
    databases.createIndex(databaseId, collectionId, 'idx_member', 'key', ['memberId']),
    databases.createIndex(databaseId, collectionId, 'idx_year', 'key', ['year']),
    databases.createIndex(databaseId, collectionId, 'idx_month', 'key', ['month'])
  ]);
  return collectionId;
}

async function setupInterestMonthly() {
  const collectionId = await ensureCollection({ name: 'interest_monthly' });
  await createAttributes(collectionId, [
    databases.createStringAttribute(databaseId, collectionId, 'month', 20, true),
    databases.createIntegerAttribute(databaseId, collectionId, 'year', true),
    databases.createIntegerAttribute(databaseId, collectionId, 'loanInterestTotal', true),
    databases.createIntegerAttribute(databaseId, collectionId, 'trustInterestTotal', true),
    databases.createDatetimeAttribute(databaseId, collectionId, 'createdAt', false),
    databases.createStringAttribute(databaseId, collectionId, 'notes', 500, false)
  ]);
  await createIndexes(collectionId, [
    databases.createIndex(databaseId, collectionId, 'idx_year', 'key', ['year']),
    databases.createIndex(databaseId, collectionId, 'idx_month', 'key', ['month'])
  ]);
  return collectionId;
}

async function setupRetainedEarnings() {
  const collectionId = await ensureCollection({ name: 'retained_earnings' });
  await createAttributes(collectionId, [
    databases.createIntegerAttribute(databaseId, collectionId, 'year', true),
    databases.createFloatAttribute(databaseId, collectionId, 'percentage', true),
    databases.createDatetimeAttribute(databaseId, collectionId, 'createdAt', false),
    databases.createStringAttribute(databaseId, collectionId, 'notes', 500, false)
  ]);
  await createIndexes(collectionId, [
    databases.createIndex(databaseId, collectionId, 'idx_year', 'unique', ['year'])
  ]);
  return collectionId;
}

async function main() {
  const ledgerId = await setupLedgerEntries();
  const interestId = await setupInterestMonthly();
  const retainedId = await setupRetainedEarnings();

  console.log('---');
  console.log('Set these in .env:');
  console.log(`VITE_APPWRITE_LEDGER_COLLECTION_ID=${ledgerId}`);
  console.log(`VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID=${interestId}`);
  console.log(`VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID=${retainedId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
