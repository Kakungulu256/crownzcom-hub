const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');

const DEFAULT_FINANCIAL_CONFIG = {
  loanInterestRate: 2,
  longTermInterestRate: 1.5,
  interestCalculationMode: 'flat'
};

const ALLOWED_INTEREST_MODES = new Set(['flat', 'reducing_balance']);

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
const configuredFinancialConfigCollectionId =
  process.env.FINANCIAL_CONFIG_COLLECTION_ID ||
  process.env.VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID ||
  fileEnv.FINANCIAL_CONFIG_COLLECTION_ID ||
  fileEnv.VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error(
    'Missing required env vars: APPWRITE/VITE_APPWRITE endpoint, project, api key, and database.'
  );
  process.exit(1);
}

const client = new sdk.Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new sdk.Databases(client);
let loansCollectionId = configuredLoansCollectionId;
let financialConfigCollectionId = configuredFinancialConfigCollectionId;

function isAlreadyExists(error) {
  return String(error?.message || '').toLowerCase().includes('already exists');
}

function toInteger(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback = 0) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeInterestMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ALLOWED_INTEREST_MODES.has(normalized) ? normalized : DEFAULT_FINANCIAL_CONFIG.interestCalculationMode;
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

function parseRepaymentPlan(loan) {
  if (!loan?.repaymentPlan) return [];
  try {
    const parsed = JSON.parse(loan.repaymentPlan);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function deriveMonthlyRatePercentFromSchedule(loan, schedule) {
  const principal = Math.max(0, toInteger(loan?.amount, 0));
  if (!principal || !Array.isArray(schedule) || schedule.length === 0) return null;

  const first = schedule[0] || {};
  const firstInterest = toFloat(first.interest, NaN);
  if (!Number.isFinite(firstInterest) || firstInterest < 0) return null;

  const derivedPercent = (firstInterest / principal) * 100;
  if (!Number.isFinite(derivedPercent) || derivedPercent < 0) return null;
  return Number(derivedPercent.toFixed(6));
}

function buildRepaymentPlanBasis(loan, mode, monthlyRatePercent, generatedAt, scheduleLength) {
  const payload = {
    loanType: loan.loanType === 'long_term' ? 'long_term' : 'short_term',
    repaymentType: loan.repaymentType === 'custom' ? 'custom' : 'equal',
    principal: Math.max(0, toInteger(loan.amount, 0)),
    months: Math.max(
      1,
      toInteger(loan.selectedMonths ?? loan.duration, 0) ||
        toInteger(scheduleLength, 0) ||
        1
    ),
    monthlyRatePercent: Number(monthlyRatePercent.toFixed(6)),
    interestCalculationMode: mode,
    hasCustomPayments: loan.repaymentType === 'custom',
    generatedBy: 'migrate-loan-schema-v4-backfill',
    generatedAt
  };

  return JSON.stringify(payload);
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

async function resolveFinancialConfigCollectionId() {
  if (financialConfigCollectionId) return financialConfigCollectionId;
  const collections = await databases.listCollections(databaseId);
  const financialConfigCollection = collections.collections.find(
    (collection) => collection.name === 'financial_config'
  );
  financialConfigCollectionId = financialConfigCollection?.$id || '';
  return financialConfigCollectionId;
}

async function getFinancialConfig() {
  const collectionId = await resolveFinancialConfigCollectionId();
  if (!collectionId) {
    return { ...DEFAULT_FINANCIAL_CONFIG };
  }

  try {
    const docs = await databases.listDocuments(databaseId, collectionId, [sdk.Query.limit(1)]);
    if (docs.documents.length === 0) {
      return { ...DEFAULT_FINANCIAL_CONFIG };
    }
    return { ...DEFAULT_FINANCIAL_CONFIG, ...docs.documents[0] };
  } catch {
    return { ...DEFAULT_FINANCIAL_CONFIG };
  }
}

async function ensureLoanSchemaV4() {
  await resolveLoansCollectionId();

  await safeCreate(
    'attribute interestCalculationModeApplied',
    () => databases.createStringAttribute(databaseId, loansCollectionId, 'interestCalculationModeApplied', 40, false)
  );
  await safeCreate(
    'attribute monthlyInterestRateApplied',
    () => databases.createFloatAttribute(databaseId, loansCollectionId, 'monthlyInterestRateApplied', false)
  );
  await safeCreate(
    'attribute repaymentPlanVersion',
    () => databases.createIntegerAttribute(databaseId, loansCollectionId, 'repaymentPlanVersion', false)
  );
  await safeCreate(
    'attribute repaymentPlanGeneratedAt',
    () => databases.createDatetimeAttribute(databaseId, loansCollectionId, 'repaymentPlanGeneratedAt', false)
  );
  await safeCreate(
    'attribute repaymentPlanBasis',
    () => databases.createStringAttribute(databaseId, loansCollectionId, 'repaymentPlanBasis', 5000, false)
  );

  await safeCreate(
    'index idx_interest_calc_mode_applied',
    () => databases.createIndex(databaseId, loansCollectionId, 'idx_interest_calc_mode_applied', 'key', ['interestCalculationModeApplied'])
  );
}

async function backfillLoanDocumentsV4() {
  await resolveLoansCollectionId();
  const config = await getFinancialConfig();
  const configMode = normalizeInterestMode(config.interestCalculationMode);

  const loans = await listAllDocuments(loansCollectionId);
  let updated = 0;

  for (const loan of loans) {
    const updates = {};
    const schedule = parseRepaymentPlan(loan);

    const mode = normalizeInterestMode(loan.interestCalculationModeApplied || configMode);
    if (!loan.interestCalculationModeApplied || normalizeInterestMode(loan.interestCalculationModeApplied) !== loan.interestCalculationModeApplied) {
      updates.interestCalculationModeApplied = mode;
    }

    const existingRate = toFloat(loan.monthlyInterestRateApplied, NaN);
    if (!Number.isFinite(existingRate) || existingRate < 0) {
      const derivedRate = deriveMonthlyRatePercentFromSchedule(loan, schedule);
      const fallbackRate = loan.loanType === 'long_term'
        ? toFloat(config.longTermInterestRate, 1.5)
        : toFloat(config.loanInterestRate, 2);
      updates.monthlyInterestRateApplied = Number((Number.isFinite(derivedRate) ? derivedRate : fallbackRate).toFixed(6));
    }

    if (loan.repaymentPlanVersion === undefined || loan.repaymentPlanVersion === null) {
      updates.repaymentPlanVersion = 1;
    }

    if (!loan.repaymentPlanGeneratedAt) {
      updates.repaymentPlanGeneratedAt =
        loan.approvedAt || loan.createdAt || loan.$createdAt || new Date().toISOString();
    }

    if (!loan.repaymentPlanBasis) {
      const rateForBasis = Number.isFinite(toFloat(updates.monthlyInterestRateApplied, NaN))
        ? toFloat(updates.monthlyInterestRateApplied, 0)
        : toFloat(loan.monthlyInterestRateApplied, loan.loanType === 'long_term' ? 1.5 : 2);
      const generatedAt = updates.repaymentPlanGeneratedAt || loan.repaymentPlanGeneratedAt || loan.createdAt || loan.$createdAt || new Date().toISOString();
      updates.repaymentPlanBasis = buildRepaymentPlanBasis(
        loan,
        updates.interestCalculationModeApplied || loan.interestCalculationModeApplied || configMode,
        rateForBasis,
        generatedAt,
        schedule.length
      );
    }

    if (Object.keys(updates).length > 0) {
      await databases.updateDocument(databaseId, loansCollectionId, loan.$id, updates);
      updated += 1;
    }
  }

  console.log(`Loan documents backfilled for v4: ${updated}`);
}

async function main() {
  await resolveLoansCollectionId();
  console.log(`Using database: ${databaseId}`);
  console.log(`Using loans collection: ${loansCollectionId}`);
  await ensureLoanSchemaV4();
  await backfillLoanDocumentsV4();
  console.log('Loan schema migration v4 complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
