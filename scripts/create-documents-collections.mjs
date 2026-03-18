import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as appwriteModule from 'node-appwrite';

const appwrite = appwriteModule.default || appwriteModule;
const { Client, Databases, Storage, Permission, Role, ID } = appwrite;

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');

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

const fileEnv = parseEnvFile(ENV_PATH);
const readEnv = (...keys) => keys.map((key) => process.env[key] || fileEnv[key]).find(Boolean) || '';

const endpoint = readEnv('APPWRITE_ENDPOINT', 'VITE_APPWRITE_ENDPOINT');
const projectId = readEnv('APPWRITE_PROJECT_ID', 'VITE_APPWRITE_PROJECT_ID');
const apiKey = readEnv('APPWRITE_API_KEY', 'VITE_APPWRITE_API_KEY');
const databaseId = readEnv('DATABASE_ID', 'VITE_APPWRITE_DATABASE_ID');

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required Appwrite env: endpoint, project id, api key, database id.');
  process.exit(1);
}

const documentsCollectionId = readEnv(
  'DOCUMENTS_COLLECTION_ID',
  'VITE_APPWRITE_DOCUMENTS_COLLECTION_ID'
) || 'documents';
const categoriesCollectionId = readEnv(
  'DOCUMENT_CATEGORIES_COLLECTION_ID',
  'VITE_APPWRITE_DOCUMENT_CATEGORIES_COLLECTION_ID'
) || 'document_categories';
const documentsBucketId = readEnv(
  'DOCUMENTS_BUCKET_ID',
  'VITE_APPWRITE_DOCUMENTS_BUCKET_ID'
) || 'documents';

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);
const storage = new Storage(client);

const adminRole = Role.label('admin');
const adminPermissions = [
  Permission.read(adminRole),
  Permission.create(adminRole),
  Permission.update(adminRole),
  Permission.delete(adminRole)
];

const isAlreadyExists = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const type = String(error?.type || '').toLowerCase();
  return (
    error?.code === 409 ||
    message.includes('already exists') ||
    type.includes('already_exists')
  );
};

const ensureCollection = async (name, id) => {
  const existing = await databases.listCollections(databaseId);
  const found = existing.collections.find((col) => col.$id === id || col.name === name);
  if (found) return found.$id;
  const created = await databases.createCollection(
    databaseId,
    id || ID.unique(),
    name,
    adminPermissions
  );
  return created.$id;
};

const ensureBucket = async (name, id) => {
  const existing = await storage.listBuckets();
  const found = existing.buckets.find((bucket) => bucket.$id === id || bucket.name === name);
  if (found) return found.$id;
  const created = await storage.createBucket(
    id || ID.unique(),
    name,
    adminPermissions,
    true
  );
  return created.$id;
};

const createAttributes = async (collectionId, actions) => {
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      if (isAlreadyExists(error)) continue;
      throw error;
    }
  }
};

const createIndexes = async (collectionId, actions) => {
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      if (isAlreadyExists(error)) continue;
      throw error;
    }
  }
};

const main = async () => {
  const documentsId = await ensureCollection('documents', documentsCollectionId);
  const categoriesId = await ensureCollection('document_categories', categoriesCollectionId);
  const bucketId = await ensureBucket('documents', documentsBucketId);

  await createAttributes(documentsId, [
    () => databases.createStringAttribute(databaseId, documentsId, 'title', 255, true),
    () => databases.createStringAttribute(databaseId, documentsId, 'category', 120, true),
    () => databases.createStringAttribute(databaseId, documentsId, 'fileId', 120, true),
    () => databases.createStringAttribute(databaseId, documentsId, 'bucketId', 120, true),
    () => databases.createStringAttribute(databaseId, documentsId, 'uploadedBy', 120, false),
    () => databases.createDatetimeAttribute(databaseId, documentsId, 'uploadedAt', false),
    () => databases.createStringAttribute(databaseId, documentsId, 'tags', 1000, false),
    () => databases.createStringAttribute(databaseId, documentsId, 'period', 30, false),
    () => databases.createStringAttribute(databaseId, documentsId, 'notes', 2000, false)
  ]);

  await createIndexes(documentsId, [
    () => databases.createIndex(databaseId, documentsId, 'idx_documents_category', 'key', ['category']),
    () => databases.createIndex(databaseId, documentsId, 'idx_documents_uploaded_at', 'key', ['uploadedAt']),
    () => databases.createIndex(databaseId, documentsId, 'idx_documents_uploaded_by', 'key', ['uploadedBy']),
    () => databases.createIndex(databaseId, documentsId, 'idx_documents_period', 'key', ['period'])
  ]);

  await createAttributes(categoriesId, [
    () => databases.createStringAttribute(databaseId, categoriesId, 'name', 120, true),
    () => databases.createStringAttribute(databaseId, categoriesId, 'description', 500, false),
    () => databases.createDatetimeAttribute(databaseId, categoriesId, 'createdAt', false),
    () => databases.createDatetimeAttribute(databaseId, categoriesId, 'updatedAt', false)
  ]);

  await createIndexes(categoriesId, [
    () => databases.createIndex(databaseId, categoriesId, 'idx_doc_categories_name', 'unique', ['name'])
  ]);

  console.log('Documents setup complete.');
  console.log('Set the following in .env if needed:');
  console.log(`VITE_APPWRITE_DOCUMENTS_COLLECTION_ID=${documentsId}`);
  console.log(`VITE_APPWRITE_DOCUMENT_CATEGORIES_COLLECTION_ID=${categoriesId}`);
  console.log(`VITE_APPWRITE_DOCUMENTS_BUCKET_ID=${bucketId}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
