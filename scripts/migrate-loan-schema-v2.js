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

async function ensureLoanSchema() {
  await resolveLoansCollectionId();
  await safeCreate(
    'attribute loanType',
    () => databases.createStringAttribute(databaseId, loansCollectionId, 'loanType', 20, false)
  );
  await safeCreate(
    'attribute selectedMonths',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'selectedMonths', false)
  );
  await safeCreate(
    'attribute termsAccepted',
    () => databases.createBooleanAttribute(databaseId, loansCollectionId, 'termsAccepted', false)
  );
  await safeCreate(
    'attribute guarantorRequired',
    () => databases.createBooleanAttribute(databaseId, loansCollectionId, 'guarantorRequired', false)
  );
  await safeCreate(
    'attribute borrowerCoverage',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'borrowerCoverage', false)
  );
  await safeCreate(
    'attribute guarantorGapAmount',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'guarantorGapAmount', false)
  );
  await safeCreate(
    'attribute guarantorRequestedAmount',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'guarantorRequestedAmount', false)
  );
  await safeCreate(
    'attribute guarantorApprovedAmount',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'guarantorApprovedAmount', false)
  );
  await safeCreate(
    'attribute guarantorApprovalStatus',
    () => databases.createStringAttribute(databaseId, loansCollectionId, 'guarantorApprovalStatus', 40, false)
  );

  await safeCreate(
    'index idx_loan_type',
    () => databases.createIndex(databaseId, loansCollectionId, 'idx_loan_type', 'key', ['loanType'])
  );
  await safeCreate(
    'index idx_guarantor_status',
    () => databases.createIndex(databaseId, loansCollectionId, 'idx_guarantor_status', 'key', ['guarantorApprovalStatus'])
  );
}

async function backfillLoanDocuments() {
  await resolveLoansCollectionId();
  const loans = await listAllDocuments(loansCollectionId);
  let updated = 0;

  for (const loan of loans) {
    const updates = {};
    if (!loan.loanType) updates.loanType = 'short_term';
    if (loan.selectedMonths === undefined || loan.selectedMonths === null) {
      updates.selectedMonths = parseInt(loan.duration, 10) || 1;
    }
    if (loan.termsAccepted === undefined || loan.termsAccepted === null) {
      updates.termsAccepted = true;
    }
    if (loan.guarantorRequired === undefined || loan.guarantorRequired === null) {
      updates.guarantorRequired = false;
    }
    if (loan.borrowerCoverage === undefined || loan.borrowerCoverage === null) {
      updates.borrowerCoverage = parseInt(loan.amount, 10) || 0;
    }
    if (loan.guarantorGapAmount === undefined || loan.guarantorGapAmount === null) {
      updates.guarantorGapAmount = 0;
    }
    if (loan.guarantorRequestedAmount === undefined || loan.guarantorRequestedAmount === null) {
      updates.guarantorRequestedAmount = 0;
    }
    if (loan.guarantorApprovedAmount === undefined || loan.guarantorApprovedAmount === null) {
      updates.guarantorApprovedAmount = 0;
    }
    if (!loan.guarantorApprovalStatus) {
      updates.guarantorApprovalStatus = 'not_required';
    }

    if (Object.keys(updates).length > 0) {
      await databases.updateDocument(databaseId, loansCollectionId, loan.$id, updates);
      updated += 1;
    }
  }

  console.log(`Loan documents backfilled: ${updated}`);
}

async function main() {
  await resolveLoansCollectionId();
  console.log(`Using database: ${databaseId}`);
  console.log(`Using loans collection: ${loansCollectionId}`);
  await ensureLoanSchema();
  await backfillLoanDocuments();
  console.log('Loan schema migration v2 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
