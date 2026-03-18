import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as appwriteModule from 'node-appwrite';

const appwrite = appwriteModule.default || appwriteModule;
const {
  Client,
  Databases,
  Permission,
  Role,
  Query,
  ID,
  RelationshipType,
  RelationMutate
} = appwrite;

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

const basePermissions = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users())
];

const collectionIdValue = (viteKey, plainKey, fallback) => readEnv(plainKey, viteKey) || fallback;

const COLLECTIONS = [
  {
    name: 'members',
    envKey: 'VITE_APPWRITE_MEMBERS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_MEMBERS_COLLECTION_ID', 'MEMBERS_COLLECTION_ID', 'members'),
    attributes: [
      { type: 'string', key: 'name', size: 255, required: true },
      { type: 'string', key: 'email', size: 255, required: true },
      { type: 'string', key: 'phone', size: 50, required: true },
      { type: 'string', key: 'membershipNumber', size: 100, required: true },
      { type: 'string', key: 'authUserId', size: 100, required: false },
      { type: 'string', key: 'joinDate', size: 30, required: false },
      { type: 'string', key: 'status', size: 30, required: true }
    ],
    indexes: [
      { key: 'idx_members_email', type: 'unique', attrs: ['email'] },
      { key: 'idx_members_membership', type: 'unique', attrs: ['membershipNumber'] },
      { key: 'idx_members_auth_user', type: 'key', attrs: ['authUserId'] },
      { key: 'idx_members_status', type: 'key', attrs: ['status'] }
    ]
  },
  {
    name: 'savings',
    envKey: 'VITE_APPWRITE_SAVINGS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_SAVINGS_COLLECTION_ID', 'SAVINGS_COLLECTION_ID', 'savings'),
    attributes: [
      { type: 'string', key: 'memberId', size: 100, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'string', key: 'month', size: 20, required: true },
      { type: 'datetime', key: 'createdAt', required: true }
    ],
    indexes: [
      { key: 'idx_savings_member', type: 'key', attrs: ['memberId'] },
      { key: 'idx_savings_month', type: 'key', attrs: ['month'] },
      { key: 'idx_savings_member_month', type: 'key', attrs: ['memberId', 'month'] }
    ]
  },
  {
    name: 'loans',
    envKey: 'VITE_APPWRITE_LOANS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_LOANS_COLLECTION_ID', 'LOANS_COLLECTION_ID', 'loans'),
    attributes: [
      { type: 'string', key: 'memberId', size: 100, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'integer', key: 'duration', required: true },
      { type: 'integer', key: 'selectedMonths', required: false },
      { type: 'string', key: 'loanType', size: 20, required: false },
      { type: 'boolean', key: 'termsAccepted', required: false },
      { type: 'string', key: 'purpose', size: 500, required: false },
      { type: 'string', key: 'repaymentType', size: 20, required: true },
      { type: 'string', key: 'repaymentPlan', size: 20000, required: false },
      { type: 'string', key: 'interestCalculationModeApplied', size: 40, required: false },
      { type: 'float', key: 'monthlyInterestRateApplied', required: false },
      { type: 'integer', key: 'repaymentPlanVersion', required: false },
      { type: 'datetime', key: 'repaymentPlanGeneratedAt', required: false },
      { type: 'string', key: 'repaymentPlanBasis', size: 5000, required: false },
      { type: 'string', key: 'status', size: 60, required: true },
      { type: 'datetime', key: 'createdAt', required: false },
      { type: 'datetime', key: 'approvedAt', required: false },
      { type: 'datetime', key: 'rejectedAt', required: false },
      { type: 'integer', key: 'balance', required: false },
      { type: 'boolean', key: 'guarantorRequired', required: false },
      { type: 'integer', key: 'borrowerCoverage', required: false },
      { type: 'integer', key: 'guarantorGapAmount', required: false },
      { type: 'integer', key: 'guarantorRequestedAmount', required: false },
      { type: 'integer', key: 'guarantorApprovedAmount', required: false },
      { type: 'string', key: 'guarantorApprovalStatus', size: 40, required: false },
      { type: 'integer', key: 'securedOriginalTotal', required: false },
      { type: 'integer', key: 'securedOutstandingTotal', required: false },
      { type: 'integer', key: 'guarantorPrincipalRecoveredTotal', required: false },
      { type: 'integer', key: 'borrowerPrincipalRecoveredTotal', required: false },
      { type: 'string', key: 'repaymentAllocationStatus', size: 30, required: false },
      { type: 'datetime', key: 'lastRepaymentAllocationAt', required: false },
      { type: 'datetime', key: 'guarantorSettlementCompletedAt', required: false }
    ],
    indexes: [
      { key: 'idx_loans_member', type: 'key', attrs: ['memberId'] },
      { key: 'idx_loans_status', type: 'key', attrs: ['status'] },
      { key: 'idx_loans_member_status', type: 'key', attrs: ['memberId', 'status'] },
      { key: 'idx_loans_loan_type', type: 'key', attrs: ['loanType'] },
      { key: 'idx_loans_guarantor_status', type: 'key', attrs: ['guarantorApprovalStatus'] },
      { key: 'idx_loans_allocation_status', type: 'key', attrs: ['repaymentAllocationStatus'] },
      { key: 'idx_loans_secured_outstanding', type: 'key', attrs: ['securedOutstandingTotal'] }
    ]
  },
  {
    name: 'loan_repayments',
    envKey: 'VITE_APPWRITE_LOAN_REPAYMENTS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_LOAN_REPAYMENTS_COLLECTION_ID', 'LOAN_REPAYMENTS_COLLECTION_ID', 'loan_repayments'),
    attributes: [
      { type: 'string', key: 'loanId', size: 100, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'integer', key: 'month', required: true },
      { type: 'datetime', key: 'paidAt', required: true },
      { type: 'boolean', key: 'isEarlyPayment', required: false }
    ],
    indexes: [
      { key: 'idx_repayments_loan', type: 'key', attrs: ['loanId'] },
      { key: 'idx_repayments_loan_month', type: 'key', attrs: ['loanId', 'month'] }
    ]
  },
  {
    name: 'loan_charges',
    envKey: 'VITE_APPWRITE_LOAN_CHARGES_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_LOAN_CHARGES_COLLECTION_ID', 'LOAN_CHARGES_COLLECTION_ID', 'loan_charges'),
    attributes: [
      { type: 'string', key: 'loanId', size: 100, required: true },
      { type: 'string', key: 'description', size: 500, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'datetime', key: 'createdAt', required: true }
    ],
    indexes: [{ key: 'idx_charges_loan', type: 'key', attrs: ['loanId'] }]
  },
  {
    name: 'subscriptions',
    envKey: 'VITE_APPWRITE_SUBSCRIPTIONS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_SUBSCRIPTIONS_COLLECTION_ID', 'SUBSCRIPTIONS_COLLECTION_ID', 'subscriptions'),
    attributes: [
      { type: 'string', key: 'memberId', size: 100, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'string', key: 'month', size: 20, required: true },
      { type: 'datetime', key: 'createdAt', required: true }
    ],
    indexes: [
      { key: 'idx_subscriptions_member', type: 'key', attrs: ['memberId'] },
      { key: 'idx_subscriptions_month', type: 'key', attrs: ['month'] }
    ]
  },
  {
    name: 'expenses',
    envKey: 'VITE_APPWRITE_EXPENSES_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_EXPENSES_COLLECTION_ID', 'EXPENSES_COLLECTION_ID', 'expenses'),
    attributes: [
      { type: 'string', key: 'description', size: 500, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'string', key: 'category', size: 120, required: true },
      { type: 'datetime', key: 'date', required: true },
      { type: 'datetime', key: 'createdAt', required: true }
    ],
    indexes: [
      { key: 'idx_expenses_date', type: 'key', attrs: ['date'] },
      { key: 'idx_expenses_category', type: 'key', attrs: ['category'] }
    ]
  },
  {
    name: 'unit_trust',
    envKey: 'VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID', 'UNIT_TRUST_COLLECTION_ID', 'unit_trust'),
    attributes: [
      { type: 'string', key: 'type', size: 50, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'string', key: 'description', size: 500, required: true },
      { type: 'datetime', key: 'date', required: true },
      { type: 'datetime', key: 'createdAt', required: true }
    ],
    indexes: [
      { key: 'idx_unit_trust_type', type: 'key', attrs: ['type'] },
      { key: 'idx_unit_trust_date', type: 'key', attrs: ['date'] }
    ]
  },
  {
    name: 'interest_allocations',
    envKey: 'VITE_APPWRITE_INTEREST_ALLOCATIONS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_INTEREST_ALLOCATIONS_COLLECTION_ID', 'INTEREST_ALLOCATIONS_COLLECTION_ID', 'interest_allocations'),
    attributes: [
      { type: 'string', key: 'memberId', size: 100, required: true },
      { type: 'integer', key: 'loanInterest', required: true },
      { type: 'integer', key: 'unitTrustInterest', required: true },
      { type: 'integer', key: 'totalInterest', required: true },
      { type: 'string', key: 'month', size: 20, required: true },
      { type: 'datetime', key: 'createdAt', required: true }
    ],
    indexes: [
      { key: 'idx_interest_alloc_member', type: 'key', attrs: ['memberId'] },
      { key: 'idx_interest_alloc_month', type: 'key', attrs: ['month'] }
    ]
  },
  {
    name: 'financial_config',
    envKey: 'VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID', 'FINANCIAL_CONFIG_COLLECTION_ID', 'financial_config'),
    attributes: [
      { type: 'float', key: 'loanInterestRate', required: true },
      { type: 'float', key: 'longTermInterestRate', required: false },
      { type: 'string', key: 'interestCalculationMode', size: 40, required: false },
      { type: 'float', key: 'loanEligibilityPercentage', required: true },
      { type: 'integer', key: 'defaultBankCharge', required: true },
      { type: 'float', key: 'earlyRepaymentPenalty', required: true },
      { type: 'integer', key: 'maxLoanDuration', required: true },
      { type: 'integer', key: 'longTermMaxRepaymentMonths', required: false },
      { type: 'integer', key: 'minLoanAmount', required: true },
      { type: 'integer', key: 'maxLoanAmount', required: true }
    ],
    indexes: []
  },
  {
    name: 'ledger_entries',
    envKey: 'VITE_APPWRITE_LEDGER_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_LEDGER_COLLECTION_ID', 'LEDGER_ENTRIES_COLLECTION_ID', 'ledger_entries'),
    attributes: [
      { type: 'string', key: 'type', size: 50, required: true },
      { type: 'integer', key: 'amount', required: true },
      { type: 'string', key: 'memberId', size: 100, required: false },
      { type: 'string', key: 'loanId', size: 100, required: false },
      { type: 'string', key: 'month', size: 20, required: false },
      { type: 'integer', key: 'year', required: false },
      { type: 'datetime', key: 'createdAt', required: false },
      { type: 'string', key: 'notes', size: 1000, required: false }
    ],
    indexes: [
      { key: 'idx_ledger_type', type: 'key', attrs: ['type'] },
      { key: 'idx_ledger_member', type: 'key', attrs: ['memberId'] },
      { key: 'idx_ledger_loan', type: 'key', attrs: ['loanId'] },
      { key: 'idx_ledger_year', type: 'key', attrs: ['year'] },
      { key: 'idx_ledger_month', type: 'key', attrs: ['month'] }
    ]
  },
  {
    name: 'interest_monthly',
    envKey: 'VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID', 'INTEREST_MONTHLY_COLLECTION_ID', 'interest_monthly'),
    attributes: [
      { type: 'string', key: 'month', size: 20, required: true },
      { type: 'integer', key: 'year', required: true },
      { type: 'integer', key: 'loanInterestTotal', required: true },
      { type: 'integer', key: 'trustInterestTotal', required: true },
      { type: 'datetime', key: 'createdAt', required: false },
      { type: 'string', key: 'notes', size: 500, required: false }
    ],
    indexes: [
      { key: 'idx_interest_monthly_year', type: 'key', attrs: ['year'] },
      { key: 'idx_interest_monthly_month', type: 'key', attrs: ['month'] },
      { key: 'idx_interest_monthly_year_month', type: 'key', attrs: ['year', 'month'] }
    ]
  },
  {
    name: 'retained_earnings',
    envKey: 'VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID', 'RETAINED_EARNINGS_COLLECTION_ID', 'retained_earnings'),
    attributes: [
      { type: 'integer', key: 'year', required: true },
      { type: 'float', key: 'percentage', required: true },
      { type: 'datetime', key: 'createdAt', required: false },
      { type: 'string', key: 'notes', size: 500, required: false }
    ],
    indexes: [{ key: 'idx_retained_year_unique', type: 'unique', attrs: ['year'] }]
  },
  {
    name: 'loan_guarantors',
    envKey: 'VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID', 'LOAN_GUARANTORS_COLLECTION_ID', 'loan_guarantors'),
    attributes: [
      { type: 'string', key: 'loanId', size: 100, required: true },
      { type: 'string', key: 'borrowerId', size: 100, required: true },
      { type: 'string', key: 'guarantorId', size: 100, required: true },
      { type: 'string', key: 'guaranteeType', size: 20, required: true },
      { type: 'float', key: 'guaranteedPercent', required: false },
      { type: 'integer', key: 'guaranteedAmount', required: true },
      { type: 'integer', key: 'approvedAmount', required: false },
      { type: 'integer', key: 'securedOutstanding', required: false },
      { type: 'string', key: 'status', size: 30, required: true },
      { type: 'string', key: 'comment', size: 500, required: false },
      { type: 'datetime', key: 'requestedAt', required: false },
      { type: 'datetime', key: 'respondedAt', required: false },
      { type: 'datetime', key: 'approvedAt', required: false },
      { type: 'datetime', key: 'declinedAt', required: false },
      { type: 'datetime', key: 'releasedAt', required: false },
      { type: 'datetime', key: 'createdAt', required: false },
      { type: 'datetime', key: 'updatedAt', required: false }
    ],
    indexes: [
      { key: 'idx_guarantors_loan', type: 'key', attrs: ['loanId'] },
      { key: 'idx_guarantors_borrower', type: 'key', attrs: ['borrowerId'] },
      { key: 'idx_guarantors_guarantor', type: 'key', attrs: ['guarantorId'] },
      { key: 'idx_guarantors_status', type: 'key', attrs: ['status'] },
      { key: 'idx_guarantors_loan_status', type: 'key', attrs: ['loanId', 'status'] },
      { key: 'idx_guarantors_unique_loan_guarantor', type: 'unique', attrs: ['loanId', 'guarantorId'] }
    ]
  },
  {
    name: 'loan_early_repayment_requests',
    envKey: 'VITE_APPWRITE_LOAN_EARLY_REPAYMENTS_COLLECTION_ID',
    id: collectionIdValue('VITE_APPWRITE_LOAN_EARLY_REPAYMENTS_COLLECTION_ID', 'LOAN_EARLY_REPAYMENTS_COLLECTION_ID', 'loan_early_repayment_requests'),
    attributes: [
      { type: 'string', key: 'loanId', size: 100, required: true },
      { type: 'string', key: 'memberId', size: 100, required: true },
      { type: 'string', key: 'status', size: 30, required: true },
      { type: 'integer', key: 'month', required: false },
      { type: 'integer', key: 'amount', required: false },
      { type: 'string', key: 'interestCalculationModeApplied', size: 40, required: false },
      { type: 'float', key: 'monthlyInterestRateApplied', required: false },
      { type: 'float', key: 'penaltyRateApplied', required: false },
      { type: 'integer', key: 'interestAmount', required: false },
      { type: 'integer', key: 'principalAmount', required: false },
      { type: 'integer', key: 'chargeAmount', required: false },
      { type: 'integer', key: 'balanceAtRequest', required: false },
      { type: 'datetime', key: 'requestedAt', required: false },
      { type: 'datetime', key: 'requestedForDate', required: false },
      { type: 'datetime', key: 'resolvedAt', required: false },
      { type: 'datetime', key: 'paidAt', required: false },
      { type: 'string', key: 'adminComment', size: 500, required: false }
    ],
    indexes: [
      { key: 'idx_early_repay_loan', type: 'key', attrs: ['loanId'] },
      { key: 'idx_early_repay_member', type: 'key', attrs: ['memberId'] },
      { key: 'idx_early_repay_status', type: 'key', attrs: ['status'] },
      { key: 'idx_early_repay_requested', type: 'key', attrs: ['requestedAt'] }
    ]
  }
];

const RELATIONSHIPS = [
  {
    source: 'savings',
    target: 'members',
    type: RelationshipType.ManyToOne,
    key: 'member',
    twoWay: true,
    twoWayKey: 'savingsRecords',
    onDelete: RelationMutate.Restrict
  },
  {
    source: 'loans',
    target: 'members',
    type: RelationshipType.ManyToOne,
    key: 'member',
    twoWay: true,
    twoWayKey: 'loanRecords',
    onDelete: RelationMutate.Restrict
  },
  {
    source: 'subscriptions',
    target: 'members',
    type: RelationshipType.ManyToOne,
    key: 'member',
    twoWay: true,
    twoWayKey: 'subscriptionRecords',
    onDelete: RelationMutate.Restrict
  },
  {
    source: 'interest_allocations',
    target: 'members',
    type: RelationshipType.ManyToOne,
    key: 'member',
    twoWay: true,
    twoWayKey: 'interestAllocationRecords',
    onDelete: RelationMutate.Restrict
  },
  {
    source: 'loan_repayments',
    target: 'loans',
    type: RelationshipType.ManyToOne,
    key: 'loan',
    twoWay: true,
    twoWayKey: 'repaymentRecords',
    onDelete: RelationMutate.Cascade
  },
  {
    source: 'loan_charges',
    target: 'loans',
    type: RelationshipType.ManyToOne,
    key: 'loan',
    twoWay: true,
    twoWayKey: 'chargeRecords',
    onDelete: RelationMutate.Cascade
  },
  {
    source: 'loan_guarantors',
    target: 'loans',
    type: RelationshipType.ManyToOne,
    key: 'loan',
    twoWay: true,
    twoWayKey: 'guarantorRequests',
    onDelete: RelationMutate.Cascade
  },
  {
    source: 'loan_guarantors',
    target: 'members',
    type: RelationshipType.ManyToOne,
    key: 'borrowerMember',
    twoWay: true,
    twoWayKey: 'borrowerGuaranteeRequests',
    onDelete: RelationMutate.Restrict
  },
  {
    source: 'loan_guarantors',
    target: 'members',
    type: RelationshipType.ManyToOne,
    key: 'guarantorMember',
    twoWay: true,
    twoWayKey: 'guarantorPledges',
    onDelete: RelationMutate.Restrict
  }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isAlreadyExists = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('already exists') || message.includes('duplicate');
};

const isCollectionNotFound = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 404 ||
    String(error?.type || '').toLowerCase() === 'collection_not_found' ||
    message.includes('not found') ||
    message.includes('could not be found')
  );
};

const isRetryableDependencyError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('not found') ||
    message.includes('attribute') ||
    message.includes('pending') ||
    message.includes('processing')
  );
};

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const createAttribute = async (collectionId, attribute) => {
  const { key, required = false } = attribute;
  if (attribute.type === 'string') {
    await databases.createStringAttribute(databaseId, collectionId, key, attribute.size || 255, required);
    return;
  }
  if (attribute.type === 'integer') {
    await databases.createIntegerAttribute(databaseId, collectionId, key, required);
    return;
  }
  if (attribute.type === 'float') {
    await databases.createFloatAttribute(databaseId, collectionId, key, required);
    return;
  }
  if (attribute.type === 'boolean') {
    await databases.createBooleanAttribute(databaseId, collectionId, key, required);
    return;
  }
  if (attribute.type === 'datetime') {
    await databases.createDatetimeAttribute(databaseId, collectionId, key, required);
    return;
  }
  throw new Error(`Unsupported attribute type: ${attribute.type}`);
};

const ensureCollection = async (definition) => {
  try {
    await databases.getCollection(databaseId, definition.id);
    console.log(`[exists] collection ${definition.name} (${definition.id})`);
  } catch (error) {
    if (!isCollectionNotFound(error)) throw error;
    await databases.createCollection(
      databaseId,
      definition.id,
      definition.name,
      basePermissions,
      false
    );
    console.log(`[created] collection ${definition.name} (${definition.id})`);
    await sleep(1200);
  }
};

const ensureAttribute = async (definition, attribute) => {
  try {
    await createAttribute(definition.id, attribute);
    console.log(`  [created] attr ${definition.name}.${attribute.key}`);
  } catch (error) {
    if (isAlreadyExists(error)) {
      console.log(`  [exists] attr ${definition.name}.${attribute.key}`);
      return;
    }
    throw error;
  }
};

const ensureIndex = async (definition, index) => {
  let attempt = 0;
  while (attempt < 10) {
    try {
      await databases.createIndex(databaseId, definition.id, index.key, index.type || 'key', index.attrs);
      console.log(`  [created] index ${definition.name}.${index.key}`);
      return;
    } catch (error) {
      if (isAlreadyExists(error)) {
        console.log(`  [exists] index ${definition.name}.${index.key}`);
        return;
      }
      if (isRetryableDependencyError(error) && attempt < 9) {
        attempt += 1;
        await sleep(1000 + attempt * 200);
        continue;
      }
      throw error;
    }
  }
};

const ensureRelationship = async (relationship) => {
  const source = COLLECTIONS.find((item) => item.name === relationship.source);
  const target = COLLECTIONS.find((item) => item.name === relationship.target);
  if (!source || !target) {
    throw new Error(
      `Invalid relationship source/target: ${relationship.source} -> ${relationship.target}`
    );
  }

  let attempt = 0;
  while (attempt < 10) {
    try {
      await databases.createRelationshipAttribute(
        databaseId,
        source.id,
        target.id,
        relationship.type,
        relationship.twoWay,
        relationship.key,
        relationship.twoWayKey,
        relationship.onDelete
      );
      console.log(
        `  [created] relationship ${relationship.source}.${relationship.key} -> ${relationship.target}`
      );
      return;
    } catch (error) {
      if (isAlreadyExists(error)) {
        console.log(
          `  [exists] relationship ${relationship.source}.${relationship.key} -> ${relationship.target}`
        );
        return;
      }
      if (isRetryableDependencyError(error) && attempt < 9) {
        attempt += 1;
        await sleep(1200 + attempt * 200);
        continue;
      }
      throw error;
    }
  }
};

const ensureDefaultFinancialConfig = async () => {
  const collection = COLLECTIONS.find((item) => item.name === 'financial_config');
  const existing = await databases.listDocuments(databaseId, collection.id, [Query.limit(1)]);
  if (existing.documents.length > 0) return;
  await databases.createDocument(databaseId, collection.id, ID.unique(), { ...DEFAULT_FINANCIAL_CONFIG });
  console.log('[created] default financial_config document');
};

const main = async () => {
  console.log(`Using Appwrite endpoint: ${endpoint}`);
  console.log(`Using Appwrite project: ${projectId}`);
  console.log(`Using Appwrite database: ${databaseId}`);

  for (const definition of COLLECTIONS) {
    await ensureCollection(definition);
    for (const attribute of definition.attributes) {
      await ensureAttribute(definition, attribute);
    }
    for (const index of definition.indexes) {
      await ensureIndex(definition, index);
    }
  }

  console.log('\nCreating relationship attributes...');
  for (const relationship of RELATIONSHIPS) {
    await ensureRelationship(relationship);
  }

  await ensureDefaultFinancialConfig();

  console.log('\nSet these collection IDs in .env (or keep the generated defaults):');
  for (const definition of COLLECTIONS) {
    console.log(`${definition.envKey}=${definition.id}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
