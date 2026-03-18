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
const unitTrustCollectionId =
  process.env.UNIT_TRUST_COLLECTION_ID ||
  process.env.VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID ||
  fileEnv.UNIT_TRUST_COLLECTION_ID ||
  fileEnv.VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID;

if (!endpoint || !projectId || !apiKey || !databaseId || !unitTrustCollectionId) {
  console.error('Missing required env vars: endpoint, project, api key, database, unit trust collection id.');
  process.exit(1);
}

const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new sdk.Databases(client);

const isAlreadyExists = (error) =>
  String(error?.message || '').toLowerCase().includes('already exists');

const safeCreate = async (label, action) => {
  try {
    await action();
    console.log(`Created: ${label}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      console.log(`Exists: ${label}`);
      return;
    }
    throw error;
  }
};

const listAllDocuments = async (collectionId, queries = []) => {
  const all = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const pageQueries = [
      ...queries,
      sdk.Query.limit(limit),
      ...(cursor ? [sdk.Query.cursorAfter(cursor)] : [])
    ];
    const response = await databases.listDocuments(databaseId, collectionId, pageQueries);
    all.push(...response.documents);
    if (response.documents.length < limit) break;
    cursor = response.documents[response.documents.length - 1].$id;
  }

  return all;
};

const backfillAmountFloat = async () => {
  const docs = await listAllDocuments(unitTrustCollectionId);
  if (docs.length === 0) {
    console.log('No unit trust records found for backfill.');
    return;
  }

  let updated = 0;
  for (const doc of docs) {
    if (doc.amountFloat !== undefined && doc.amountFloat !== null) continue;
    const amountValue = Number(doc.amount) || 0;
    await databases.updateDocument(
      databaseId,
      unitTrustCollectionId,
      doc.$id,
      { amountFloat: amountValue }
    );
    updated += 1;
  }

  console.log(`Unit trust records backfilled: ${updated}`);
};

async function main() {
  console.log(`Using database: ${databaseId}`);
  console.log(`Using unit trust collection: ${unitTrustCollectionId}`);
  await safeCreate(
    'attribute amountFloat',
    () =>
      databases.createFloatAttribute(
        databaseId,
        unitTrustCollectionId,
        'amountFloat',
        false
      )
  );
  await backfillAmountFloat();
  console.log('Unit trust schema migration v2 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
