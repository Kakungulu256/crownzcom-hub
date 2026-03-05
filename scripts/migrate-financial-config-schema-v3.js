const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

const DEFAULT_FINANCIAL_CONFIG = {
  loanInterestRate: 2,
  longTermInterestRate: 1.5,
  interestCalculationMode: 'flat',
  loanEligibilityPercentage: 80,
  defaultBankCharge: 5000,
  earlyRepaymentPenalty: 1,
  maxLoanDuration: 6,
  longTermMaxRepaymentMonths: 24,
  minLoanAmount: 10000,
  maxLoanAmount: 5000000
};

const ALLOWED_MODES = new Set(['flat', 'reducing_balance']);

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
const financialConfigCollectionId =
  process.env.FINANCIAL_CONFIG_COLLECTION_ID ||
  process.env.VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID ||
  fileEnv.FINANCIAL_CONFIG_COLLECTION_ID ||
  fileEnv.VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID;

if (!endpoint || !projectId || !apiKey || !databaseId || !financialConfigCollectionId) {
  console.error(
    'Missing required env vars: endpoint, project, api key, database, financial config collection id.'
  );
  process.exit(1);
}

const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new sdk.Databases(client);

function isAlreadyExists(error) {
  return String(error?.message || '').toLowerCase().includes('already exists');
}

async function safeCreate(label, action) {
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
}

async function listAllDocuments(collectionId, queries = []) {
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
}

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return ALLOWED_MODES.has(mode) ? mode : DEFAULT_FINANCIAL_CONFIG.interestCalculationMode;
}

async function ensureFinancialConfigSchemaV3() {
  await safeCreate(
    'attribute interestCalculationMode',
    () =>
      databases.createStringAttribute(
        databaseId,
        financialConfigCollectionId,
        'interestCalculationMode',
        40,
        false
      )
  );
}

async function backfillFinancialConfigDocs() {
  const docs = await listAllDocuments(financialConfigCollectionId);

  if (docs.length === 0) {
    await databases.createDocument(
      databaseId,
      financialConfigCollectionId,
      sdk.ID.unique(),
      { ...DEFAULT_FINANCIAL_CONFIG }
    );
    console.log('Created default financial config document.');
    return;
  }

  let updated = 0;
  for (const doc of docs) {
    const updates = {};
    if (doc.interestCalculationMode === undefined || doc.interestCalculationMode === null) {
      updates.interestCalculationMode = DEFAULT_FINANCIAL_CONFIG.interestCalculationMode;
    } else {
      const normalized = normalizeMode(doc.interestCalculationMode);
      if (normalized !== doc.interestCalculationMode) {
        updates.interestCalculationMode = normalized;
      }
    }

    if (Object.keys(updates).length > 0) {
      await databases.updateDocument(databaseId, financialConfigCollectionId, doc.$id, updates);
      updated += 1;
    }
  }

  console.log(`Financial config documents backfilled: ${updated}`);
}

async function main() {
  console.log(`Using database: ${databaseId}`);
  console.log(`Using financial config collection: ${financialConfigCollectionId}`);
  await ensureFinancialConfigSchemaV3();
  await backfillFinancialConfigDocs();
  console.log('Financial config schema migration v3 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
