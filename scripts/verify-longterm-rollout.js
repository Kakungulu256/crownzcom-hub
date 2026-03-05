const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const sdk = require('node-appwrite');

const { Client, Databases, Query } = sdk;

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    result[key] = value;
  }
  return result;
};

const rootDir = path.resolve(__dirname, '..');
const fileEnv = parseEnvFile(path.join(rootDir, '.env'));
const readEnv = (key) => process.env[key] || fileEnv[key] || '';

const ensureEnvAliases = () => {
  process.env.APPWRITE_ENDPOINT =
    process.env.APPWRITE_ENDPOINT ||
    readEnv('APPWRITE_ENDPOINT') ||
    readEnv('VITE_APPWRITE_ENDPOINT');
  process.env.APPWRITE_PROJECT_ID =
    process.env.APPWRITE_PROJECT_ID ||
    readEnv('APPWRITE_PROJECT_ID') ||
    readEnv('VITE_APPWRITE_PROJECT_ID');
  process.env.APPWRITE_API_KEY =
    process.env.APPWRITE_API_KEY ||
    readEnv('APPWRITE_API_KEY') ||
    readEnv('VITE_APPWRITE_API_KEY');

  process.env.DATABASE_ID =
    process.env.DATABASE_ID ||
    readEnv('DATABASE_ID') ||
    readEnv('VITE_APPWRITE_DATABASE_ID');

  process.env.LOANS_COLLECTION_ID =
    process.env.LOANS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LOANS_COLLECTION_ID');
  process.env.LOAN_GUARANTORS_COLLECTION_ID =
    process.env.LOAN_GUARANTORS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID');
  process.env.FINANCIAL_CONFIG_COLLECTION_ID =
    process.env.FINANCIAL_CONFIG_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID');
};

ensureEnvAliases();

const REQUIRED = [
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'DATABASE_ID'
];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env for verification: ${missing.join(', ')}`);
  process.exit(1);
}

const runNodeScript = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);
  const result = spawnSync(process.execPath, [absolutePath], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: node ${relativePath}`);
  }
};

const resolveCollectionIdsByName = async () => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const databases = new Databases(client);
  const collections = await databases.listCollections(process.env.DATABASE_ID);
  const byName = new Map(collections.collections.map((collection) => [collection.name, collection.$id]));

  process.env.LOANS_COLLECTION_ID = process.env.LOANS_COLLECTION_ID || byName.get('loans') || '';
  process.env.LOAN_GUARANTORS_COLLECTION_ID =
    process.env.LOAN_GUARANTORS_COLLECTION_ID || byName.get('loan_guarantors') || '';
  process.env.FINANCIAL_CONFIG_COLLECTION_ID =
    process.env.FINANCIAL_CONFIG_COLLECTION_ID || byName.get('financial_config') || '';
};

const listAllAttributes = async (databases, databaseId, collectionId) => {
  const all = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const queries = [
      Query.limit(limit),
      ...(cursor ? [Query.cursorAfter(cursor)] : [])
    ];
    const response = await databases.listAttributes(databaseId, collectionId, queries);
    all.push(...response.attributes);
    if (response.attributes.length < limit) break;
    cursor = response.attributes[response.attributes.length - 1].$id;
  }
  return all;
};

const verifyCollectionAttributes = async (databases, databaseId, collectionId, requiredKeys, label) => {
  const attributes = await listAllAttributes(databases, databaseId, collectionId);
  const existing = new Set(attributes.map((attribute) => attribute.key));
  const missingKeys = requiredKeys.filter((key) => !existing.has(key));
  if (missingKeys.length > 0) {
    throw new Error(`${label} missing attributes: ${missingKeys.join(', ')}`);
  }
  console.log(`Verified ${label} attributes (${requiredKeys.length})`);
};

const verifyEndpointReachability = async () => {
  const endpoint = process.env.APPWRITE_ENDPOINT.replace(/\/+$/, '');
  const healthUrl = endpoint.endsWith('/v1') ? `${endpoint}/health` : `${endpoint}/v1/health`;

  let response;
  try {
    response = await fetch(healthUrl, { method: 'GET' });
  } catch (error) {
    throw new Error(
      `Cannot reach Appwrite endpoint (${healthUrl}). Check network/DNS and endpoint value.`
    );
  }

  // 2xx confirms health endpoint works. 401/403/404 still confirms endpoint is reachable.
  if (response.status >= 500) {
    throw new Error(
      `Appwrite endpoint preflight failed (${response.status}) at ${healthUrl}.`
    );
  }
  console.log(`Endpoint preflight reachable: ${healthUrl} (status ${response.status})`);
};

const main = async () => {
  console.log('Preflight: Verify Appwrite endpoint reachability');
  await verifyEndpointReachability();
  await resolveCollectionIdsByName();

  console.log('Step 1/5: Ensure loan_guarantors collection + schema');
  runNodeScript('scripts/create-loan-guarantors-collection.js');
  await resolveCollectionIdsByName();

  const missingCollections = [
    'LOANS_COLLECTION_ID',
    'LOAN_GUARANTORS_COLLECTION_ID',
    'FINANCIAL_CONFIG_COLLECTION_ID'
  ].filter((key) => !process.env[key]);
  if (missingCollections.length > 0) {
    throw new Error(
      `Missing collection IDs after discovery: ${missingCollections.join(', ')}. ` +
      'Set explicit collection IDs in environment.'
    );
  }

  console.log('Step 2/5: Run financial config + loan migrations');
  runNodeScript('scripts/migrate-financial-config-schema-v2.js');
  runNodeScript('scripts/migrate-financial-config-schema-v3.js');
  runNodeScript('scripts/migrate-loan-schema-v2.js');
  runNodeScript('scripts/migrate-loan-schema-v3.js');
  runNodeScript('scripts/migrate-loan-schema-v4.js');

  console.log('Step 3/5: Verify migrated schema attributes');
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const databases = new Databases(client);
  const databaseId = process.env.DATABASE_ID;

  await verifyCollectionAttributes(
    databases,
    databaseId,
    process.env.LOANS_COLLECTION_ID,
    [
      'loanType',
      'selectedMonths',
      'termsAccepted',
      'guarantorRequired',
      'borrowerCoverage',
      'guarantorGapAmount',
      'guarantorRequestedAmount',
      'guarantorApprovedAmount',
      'guarantorApprovalStatus',
      'securedOriginalTotal',
      'securedOutstandingTotal',
      'guarantorPrincipalRecoveredTotal',
      'borrowerPrincipalRecoveredTotal',
      'repaymentAllocationStatus',
      'lastRepaymentAllocationAt',
      'guarantorSettlementCompletedAt',
      'interestCalculationModeApplied',
      'monthlyInterestRateApplied',
      'repaymentPlanVersion',
      'repaymentPlanGeneratedAt',
      'repaymentPlanBasis'
    ],
    'loans'
  );

  await verifyCollectionAttributes(
    databases,
    databaseId,
    process.env.FINANCIAL_CONFIG_COLLECTION_ID,
    ['longTermInterestRate', 'longTermMaxRepaymentMonths', 'interestCalculationMode'],
    'financial_config'
  );

  await verifyCollectionAttributes(
    databases,
    databaseId,
    process.env.LOAN_GUARANTORS_COLLECTION_ID,
    [
      'loanId',
      'borrowerId',
      'guarantorId',
      'guaranteeType',
      'guaranteedPercent',
      'guaranteedAmount',
      'approvedAmount',
      'securedOutstanding',
      'status',
      'comment',
      'requestedAt',
      'respondedAt',
      'approvedAt',
      'declinedAt',
      'releasedAt',
      'createdAt',
      'updatedAt'
    ],
    'loan_guarantors'
  );

  console.log('Step 4/5: Run repayment unit tests');
  runNodeScript('tests/waterfall-repayment.test.js');
  runNodeScript('tests/interest-calculation.test.js');

  console.log('Step 5/5: Run end-to-end long-term loan workflow verification');
  runNodeScript('scripts/e2e-longterm-loan-flow.js');

  console.log('Long-term rollout verification complete.');
};

main().catch((error) => {
  console.error(`Rollout verification failed: ${error.message}`);
  process.exit(1);
});
