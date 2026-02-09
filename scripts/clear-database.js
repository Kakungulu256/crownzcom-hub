const sdk = require('node-appwrite');

const fs = require('fs');
const path = require('path');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  COLLECTION_IDS,
  VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_API_KEY,
  VITE_APPWRITE_DATABASE_ID
} = process.env;

const envFromFile = {};
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, 'utf-8');
  contents.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    envFromFile[key] = value;
  });
}

const endpoint = APPWRITE_ENDPOINT || VITE_APPWRITE_ENDPOINT || envFromFile.APPWRITE_ENDPOINT || envFromFile.VITE_APPWRITE_ENDPOINT;
const projectId = APPWRITE_PROJECT_ID || VITE_APPWRITE_PROJECT_ID || envFromFile.APPWRITE_PROJECT_ID || envFromFile.VITE_APPWRITE_PROJECT_ID;
const apiKey = APPWRITE_API_KEY || VITE_APPWRITE_API_KEY || envFromFile.APPWRITE_API_KEY || envFromFile.VITE_APPWRITE_API_KEY;
const databaseId = DATABASE_ID || VITE_APPWRITE_DATABASE_ID || envFromFile.DATABASE_ID || envFromFile.VITE_APPWRITE_DATABASE_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents');
  process.exit(1);
}

const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

async function listAllDocuments(collectionId) {
  const all = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const queries = [
      sdk.Query.limit(limit),
      ...(cursor ? [sdk.Query.cursorAfter(cursor)] : [])
    ];
    const response = await databases.listDocuments(databaseId, collectionId, queries);
    all.push(...response.documents);
    if (response.documents.length < limit) break;
    cursor = response.documents[response.documents.length - 1].$id;
  }

  return all;
}

async function clearCollection(collectionId) {
  const docs = await listAllDocuments(collectionId);
  let deleted = 0;
  for (const doc of docs) {
    await databases.deleteDocument(databaseId, collectionId, doc.$id);
    deleted += 1;
  }
  console.log(`Cleared ${deleted} documents from ${collectionId}`);
}

async function main() {
  let collectionIds = [];
  if (COLLECTION_IDS) {
    collectionIds = COLLECTION_IDS.split(',').map(id => id.trim()).filter(Boolean);
    if (collectionIds.length === 0) {
      console.error('No valid collection IDs provided.');
      process.exit(1);
    }
  } else {
    const collectionsResponse = await databases.listCollections(databaseId);
    collectionIds = collectionsResponse.collections.map(collection => collection.$id);
  }

  console.log(`About to delete ALL documents from ${collectionIds.length} collection(s) in database ${databaseId}.`);
  console.log(`Collections: ${collectionIds.join(', ')}`);
  console.log('Type "DELETE" to confirm:');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmation = await new Promise(resolve => rl.question('> ', answer => resolve(answer)));
  rl.close();

  if (confirmation !== 'DELETE') {
    console.log('Aborted. No documents were deleted.');
    process.exit(0);
  }

  for (const collectionId of collectionIds) {
    await clearCollection(collectionId);
  }
  console.log('Database clear complete.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
