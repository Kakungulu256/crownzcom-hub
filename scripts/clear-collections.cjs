const fs = require('fs');
const path = require('path');
const sdk = require('node-appwrite');

const { Client, Databases, Query } = sdk;

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const output = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    output[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return output;
};

const rootDir = path.resolve(__dirname, '..');
const fileEnv = parseEnvFile(path.join(rootDir, '.env'));
const readEnv = (...keys) => keys.map((key) => process.env[key] || fileEnv[key]).find(Boolean) || '';

const endpoint = readEnv('APPWRITE_ENDPOINT', 'VITE_APPWRITE_ENDPOINT');
const projectId = readEnv('APPWRITE_PROJECT_ID', 'VITE_APPWRITE_PROJECT_ID');
const apiKey = readEnv('APPWRITE_API_KEY', 'VITE_APPWRITE_API_KEY');
const databaseId = readEnv('DATABASE_ID', 'VITE_APPWRITE_DATABASE_ID');

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required Appwrite env: endpoint, project id, api key, database id.');
  process.exit(1);
}

const force = process.argv.includes('--yes');
if (!force) {
  console.error('Refusing to run without --yes. This script deletes all documents and collections.');
  process.exit(1);
}

const idsArg = process.argv.find((arg) => arg.startsWith('--ids='));
const requestedIds = idsArg
  ? idsArg
      .slice('--ids='.length)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  : [];

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1200;

const isRetryableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const causeCode = String(error?.cause?.code || '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('connect timeout') ||
    causeCode.includes('und_err_connect_timeout') ||
    causeCode.includes('econnreset') ||
    causeCode.includes('etimedout')
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (label, action) => {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      const waitMs = BASE_DELAY_MS * attempt;
      console.warn(
        `${label} failed (attempt ${attempt}/${MAX_RETRIES}) with network timeout. Retrying in ${waitMs}ms...`
      );
      await sleep(waitMs);
    }
  }
  throw lastError;
};

const listAllDocuments = async (collectionId) => {
  const docs = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const queries = [Query.limit(limit), ...(cursor ? [Query.cursorAfter(cursor)] : [])];
    const response = await withRetry(
      `listDocuments(${collectionId})`,
      () => databases.listDocuments(databaseId, collectionId, queries)
    );
    docs.push(...response.documents);
    if (response.documents.length < limit) break;
    cursor = response.documents[response.documents.length - 1].$id;
  }

  return docs;
};

const clearCollectionDocuments = async (collectionId) => {
  const docs = await listAllDocuments(collectionId);
  for (const doc of docs) {
    await withRetry(
      `deleteDocument(${collectionId}, ${doc.$id})`,
      () => databases.deleteDocument(databaseId, collectionId, doc.$id)
    );
  }
  return docs.length;
};

const main = async () => {
  const collectionsResponse = await withRetry(
    `listCollections(${databaseId})`,
    () => databases.listCollections(databaseId)
  );
  const allCollections = collectionsResponse.collections;
  const targetCollections =
    requestedIds.length > 0
      ? allCollections.filter((collection) => requestedIds.includes(collection.$id))
      : allCollections;

  if (targetCollections.length === 0) {
    console.log('No collections matched the requested scope. Nothing to delete.');
    return;
  }

  console.log(`Deleting ${targetCollections.length} collection(s) from database ${databaseId}...`);

  for (const collection of targetCollections) {
    const deletedDocs = await clearCollectionDocuments(collection.$id);
    await withRetry(
      `deleteCollection(${collection.$id})`,
      () => databases.deleteCollection(databaseId, collection.$id)
    );
    console.log(`Deleted collection ${collection.name} (${collection.$id}), removed ${deletedDocs} document(s).`);
  }

  console.log('Collection cleanup complete.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
