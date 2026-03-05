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
const configuredLoansCollectionId =
  process.env.LOANS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_LOANS_COLLECTION_ID ||
  fileEnv.LOANS_COLLECTION_ID ||
  fileEnv.VITE_APPWRITE_LOANS_COLLECTION_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error(
    'Missing required env vars: APPWRITE/VITE_APPWRITE endpoint, project, api key, and database.'
  );
  process.exit(1);
}

const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new sdk.Databases(client);
let loansCollectionId = configuredLoansCollectionId;

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

function isAlreadyExists(error) {
  return String(error?.message || '').toLowerCase().includes('already exists');
}

function toNumber(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function deriveInitialAllocationStatus({ guarantorRequired, approvedAmount, securedOutstanding }) {
  if (!guarantorRequired || approvedAmount <= 0) {
    return 'not_required';
  }
  if (securedOutstanding > 0) {
    return 'guarantor_priority';
  }
  return 'borrower_priority';
}

async function resolveLoansCollectionId() {
  if (loansCollectionId) return loansCollectionId;
  const collections = await databases.listCollections(databaseId);
  const loansCollection = collections.collections.find((collection) => collection.name === 'loans');
  if (!loansCollection) {
    throw new Error(
      'Unable to resolve loans collection. Set LOANS_COLLECTION_ID or VITE_APPWRITE_LOANS_COLLECTION_ID.'
    );
  }
  loansCollectionId = loansCollection.$id;
  return loansCollectionId;
}

async function ensureLoanSchemaV3() {
  await resolveLoansCollectionId();
  await safeCreate(
    'attribute securedOriginalTotal',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'securedOriginalTotal', false)
  );
  await safeCreate(
    'attribute securedOutstandingTotal',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'securedOutstandingTotal', false)
  );
  await safeCreate(
    'attribute guarantorPrincipalRecoveredTotal',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'guarantorPrincipalRecoveredTotal', false)
  );
  await safeCreate(
    'attribute borrowerPrincipalRecoveredTotal',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'borrowerPrincipalRecoveredTotal', false)
  );
  await safeCreate(
    'attribute repaymentAllocationStatus',
    () => databases.createStringAttribute(databaseId, loansCollectionId, 'repaymentAllocationStatus', 30, false)
  );
  await safeCreate(
    'attribute lastRepaymentAllocationAt',
    () => databases.createDatetimeAttribute(databaseId, loansCollectionId, 'lastRepaymentAllocationAt', false)
  );
  await safeCreate(
    'attribute guarantorSettlementCompletedAt',
    () => databases.createDatetimeAttribute(databaseId, loansCollectionId, 'guarantorSettlementCompletedAt', false)
  );

  await safeCreate(
    'index idx_repayment_allocation_status',
    () => databases.createIndex(databaseId, loansCollectionId, 'idx_repayment_allocation_status', 'key', ['repaymentAllocationStatus'])
  );
  await safeCreate(
    'index idx_secured_outstanding_total',
    () => databases.createIndex(databaseId, loansCollectionId, 'idx_secured_outstanding_total', 'key', ['securedOutstandingTotal'])
  );
}

async function backfillLoanDocumentsV3() {
  await resolveLoansCollectionId();
  const loans = await listAllDocuments(loansCollectionId);
  let updated = 0;

  for (const loan of loans) {
    const updates = {};
    const guarantorRequired = Boolean(loan.guarantorRequired ?? false);
    const approvedAmount = toNumber(loan.guarantorApprovedAmount, 0);

    if (loan.securedOriginalTotal === undefined || loan.securedOriginalTotal === null) {
      updates.securedOriginalTotal = approvedAmount;
    }
    if (loan.securedOutstandingTotal === undefined || loan.securedOutstandingTotal === null) {
      updates.securedOutstandingTotal = approvedAmount;
    }
    if (loan.guarantorPrincipalRecoveredTotal === undefined || loan.guarantorPrincipalRecoveredTotal === null) {
      updates.guarantorPrincipalRecoveredTotal = 0;
    }
    if (loan.borrowerPrincipalRecoveredTotal === undefined || loan.borrowerPrincipalRecoveredTotal === null) {
      updates.borrowerPrincipalRecoveredTotal = 0;
    }
    if (!loan.repaymentAllocationStatus) {
      const securedOutstanding = toNumber(
        updates.securedOutstandingTotal !== undefined ? updates.securedOutstandingTotal : loan.securedOutstandingTotal,
        0
      );
      updates.repaymentAllocationStatus = deriveInitialAllocationStatus({
        guarantorRequired,
        approvedAmount,
        securedOutstanding
      });
    }

    if (Object.keys(updates).length > 0) {
      await databases.updateDocument(databaseId, loansCollectionId, loan.$id, updates);
      updated += 1;
    }
  }

  console.log(`Loan documents backfilled for v3: ${updated}`);
}

async function main() {
  await resolveLoansCollectionId();
  console.log(`Using database: ${databaseId}`);
  console.log(`Using loans collection: ${loansCollectionId}`);
  await ensureLoanSchemaV3();
  await backfillLoanDocumentsV3();
  console.log('Loan schema migration v3 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
