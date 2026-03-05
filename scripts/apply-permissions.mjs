import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as appwriteModule from 'node-appwrite';

const appwrite = appwriteModule.default || appwriteModule;
const { Client, Databases, Permission, Role } = appwrite;

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

const publicMode = process.argv.includes('--public');
const openRole = publicMode ? Role.any() : Role.users();
const permissions = [
  Permission.read(openRole),
  Permission.create(openRole),
  Permission.update(openRole),
  Permission.delete(openRole)
];

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const idVars = [
  ['members', readEnv('MEMBERS_COLLECTION_ID', 'VITE_APPWRITE_MEMBERS_COLLECTION_ID')],
  ['savings', readEnv('SAVINGS_COLLECTION_ID', 'VITE_APPWRITE_SAVINGS_COLLECTION_ID')],
  ['loans', readEnv('LOANS_COLLECTION_ID', 'VITE_APPWRITE_LOANS_COLLECTION_ID')],
  ['loan_repayments', readEnv('LOAN_REPAYMENTS_COLLECTION_ID', 'VITE_APPWRITE_LOAN_REPAYMENTS_COLLECTION_ID')],
  ['loan_charges', readEnv('LOAN_CHARGES_COLLECTION_ID', 'VITE_APPWRITE_LOAN_CHARGES_COLLECTION_ID')],
  ['subscriptions', readEnv('SUBSCRIPTIONS_COLLECTION_ID', 'VITE_APPWRITE_SUBSCRIPTIONS_COLLECTION_ID')],
  ['expenses', readEnv('EXPENSES_COLLECTION_ID', 'VITE_APPWRITE_EXPENSES_COLLECTION_ID')],
  ['unit_trust', readEnv('UNIT_TRUST_COLLECTION_ID', 'VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID')],
  ['interest_allocations', readEnv('INTEREST_ALLOCATIONS_COLLECTION_ID', 'VITE_APPWRITE_INTEREST_ALLOCATIONS_COLLECTION_ID')],
  ['financial_config', readEnv('FINANCIAL_CONFIG_COLLECTION_ID', 'VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID')],
  ['ledger_entries', readEnv('LEDGER_ENTRIES_COLLECTION_ID', 'VITE_APPWRITE_LEDGER_COLLECTION_ID')],
  ['interest_monthly', readEnv('INTEREST_MONTHLY_COLLECTION_ID', 'VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID')],
  ['retained_earnings', readEnv('RETAINED_EARNINGS_COLLECTION_ID', 'VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID')],
  ['loan_guarantors', readEnv('LOAN_GUARANTORS_COLLECTION_ID', 'VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID')]
];

const main = async () => {
  const all = await databases.listCollections(databaseId);
  const allById = new Map(all.collections.map((collection) => [collection.$id, collection]));
  const allByName = new Map(all.collections.map((collection) => [collection.name, collection]));

  const targetCollections = [];
  for (const [name, id] of idVars) {
    if (id && allById.has(id)) {
      targetCollections.push(allById.get(id));
      continue;
    }
    if (allByName.has(name)) {
      targetCollections.push(allByName.get(name));
    }
  }

  const uniqueTargets = [...new Map(targetCollections.map((collection) => [collection.$id, collection])).values()];
  if (uniqueTargets.length === 0) {
    throw new Error('No target collections found. Check collection IDs in your environment.');
  }

  console.log(`Applying ${publicMode ? 'public' : 'authenticated-user'} permissions to ${uniqueTargets.length} collection(s)...`);
  for (const collection of uniqueTargets) {
    await databases.updateCollection(
      databaseId,
      collection.$id,
      collection.name,
      permissions,
      false,
      collection.enabled
    );
    console.log(`Updated permissions: ${collection.name} (${collection.$id})`);
  }
  console.log('Collection permission update complete.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
