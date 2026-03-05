const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

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

const endpoint =
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT ||
  fileEnv.APPWRITE_ENDPOINT ||
  fileEnv.VITE_APPWRITE_ENDPOINT;
const projectId =
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID ||
  fileEnv.APPWRITE_PROJECT_ID ||
  fileEnv.VITE_APPWRITE_PROJECT_ID;
const apiKey =
  process.env.APPWRITE_API_KEY ||
  process.env.VITE_APPWRITE_API_KEY ||
  fileEnv.APPWRITE_API_KEY ||
  fileEnv.VITE_APPWRITE_API_KEY;
const databaseId =
  process.env.DATABASE_ID ||
  process.env.VITE_APPWRITE_DATABASE_ID ||
  fileEnv.DATABASE_ID ||
  fileEnv.VITE_APPWRITE_DATABASE_ID;
const collectionIdHint =
  process.env.LOAN_GUARANTORS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID ||
  fileEnv.LOAN_GUARANTORS_COLLECTION_ID ||
  fileEnv.VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID ||
  '';

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error(
    'Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents'
  );
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
      await action();
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      const type = String(error?.type || '').toLowerCase();
      if (
        error?.code === 409 ||
        message.includes('already exists') ||
        type === 'attribute_already_exists'
      ) {
        continue;
      }
      throw error;
    }
  }
}

async function createIndexes(collectionId, actions) {
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      const type = String(error?.type || '').toLowerCase();
      if (
        error?.code === 409 ||
        message.includes('already exists') ||
        type === 'index_already_exists'
      ) {
        continue;
      }
      throw error;
    }
  }
}

async function main() {
  const collectionId = await ensureCollection({
    name: 'loan_guarantors',
    id: collectionIdHint
  });

  await createAttributes(collectionId, [
    () => databases.createStringAttribute(databaseId, collectionId, 'loanId', 100, true),
    () => databases.createStringAttribute(databaseId, collectionId, 'borrowerId', 100, true),
    () => databases.createStringAttribute(databaseId, collectionId, 'guarantorId', 100, true),
    () => databases.createStringAttribute(databaseId, collectionId, 'guaranteeType', 20, true),
    () => databases.createFloatAttribute(databaseId, collectionId, 'guaranteedPercent', false),
    () => databases.createIntegerAttribute(databaseId, collectionId, 'guaranteedAmount', true),
    () => databases.createIntegerAttribute(databaseId, collectionId, 'approvedAmount', false),
    () => databases.createIntegerAttribute(databaseId, collectionId, 'securedOutstanding', false),
    () => databases.createStringAttribute(databaseId, collectionId, 'status', 30, true),
    () => databases.createStringAttribute(databaseId, collectionId, 'comment', 500, false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'requestedAt', false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'respondedAt', false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'approvedAt', false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'declinedAt', false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'releasedAt', false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'createdAt', false),
    () => databases.createDatetimeAttribute(databaseId, collectionId, 'updatedAt', false)
  ]);

  await createIndexes(collectionId, [
    () => databases.createIndex(databaseId, collectionId, 'idx_loan', 'key', ['loanId']),
    () => databases.createIndex(databaseId, collectionId, 'idx_borrower', 'key', ['borrowerId']),
    () => databases.createIndex(databaseId, collectionId, 'idx_guarantor', 'key', ['guarantorId']),
    () => databases.createIndex(databaseId, collectionId, 'idx_status', 'key', ['status']),
    () => databases.createIndex(databaseId, collectionId, 'idx_loan_status', 'key', ['loanId', 'status']),
    () => databases.createIndex(databaseId, collectionId, 'idx_loan_guarantor_unique', 'unique', ['loanId', 'guarantorId'])
  ]);

  console.log('---');
  console.log('Set this in .env:');
  console.log(`VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID=${collectionId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
