const path = require('path');
const fs = require('fs');
const assert = require('node:assert/strict');
const sdk = require('node-appwrite');

const { Client, Databases, Query, ID } = sdk;

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
  process.env.APPWRITE_FUNCTION_ENDPOINT =
    process.env.APPWRITE_FUNCTION_ENDPOINT ||
    readEnv('APPWRITE_ENDPOINT') ||
    readEnv('VITE_APPWRITE_ENDPOINT');
  process.env.APPWRITE_FUNCTION_PROJECT_ID =
    process.env.APPWRITE_FUNCTION_PROJECT_ID ||
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

  process.env.MEMBERS_COLLECTION_ID =
    process.env.MEMBERS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_MEMBERS_COLLECTION_ID');
  process.env.SAVINGS_COLLECTION_ID =
    process.env.SAVINGS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_SAVINGS_COLLECTION_ID');
  process.env.LOANS_COLLECTION_ID =
    process.env.LOANS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LOANS_COLLECTION_ID');
  process.env.LOAN_REPAYMENTS_COLLECTION_ID =
    process.env.LOAN_REPAYMENTS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LOAN_REPAYMENTS_COLLECTION_ID');
  process.env.LOAN_CHARGES_COLLECTION_ID =
    process.env.LOAN_CHARGES_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LOAN_CHARGES_COLLECTION_ID');
  process.env.LOAN_GUARANTORS_COLLECTION_ID =
    process.env.LOAN_GUARANTORS_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LOAN_GUARANTORS_COLLECTION_ID');
  process.env.FINANCIAL_CONFIG_COLLECTION_ID =
    process.env.FINANCIAL_CONFIG_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID');
  process.env.LEDGER_ENTRIES_COLLECTION_ID =
    process.env.LEDGER_ENTRIES_COLLECTION_ID ||
    readEnv('VITE_APPWRITE_LEDGER_COLLECTION_ID');
};

ensureEnvAliases();

const REQUIRED = ['APPWRITE_FUNCTION_ENDPOINT', 'APPWRITE_FUNCTION_PROJECT_ID', 'APPWRITE_API_KEY', 'DATABASE_ID'];

const DATABASE_ID = process.env.DATABASE_ID;
const COLLECTIONS = {};

const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);

const resolveCollectionIdsByName = async () => {
  const response = await databases.listCollections(process.env.DATABASE_ID);
  const byName = new Map(response.collections.map((collection) => [collection.name, collection.$id]));

  process.env.MEMBERS_COLLECTION_ID = process.env.MEMBERS_COLLECTION_ID || byName.get('members') || '';
  process.env.SAVINGS_COLLECTION_ID = process.env.SAVINGS_COLLECTION_ID || byName.get('savings') || '';
  process.env.LOANS_COLLECTION_ID = process.env.LOANS_COLLECTION_ID || byName.get('loans') || '';
  process.env.LOAN_REPAYMENTS_COLLECTION_ID =
    process.env.LOAN_REPAYMENTS_COLLECTION_ID || byName.get('loan_repayments') || '';
  process.env.LOAN_CHARGES_COLLECTION_ID =
    process.env.LOAN_CHARGES_COLLECTION_ID || byName.get('loan_charges') || '';
  process.env.LOAN_GUARANTORS_COLLECTION_ID =
    process.env.LOAN_GUARANTORS_COLLECTION_ID || byName.get('loan_guarantors') || '';
  process.env.FINANCIAL_CONFIG_COLLECTION_ID =
    process.env.FINANCIAL_CONFIG_COLLECTION_ID || byName.get('financial_config') || '';
  process.env.LEDGER_ENTRIES_COLLECTION_ID =
    process.env.LEDGER_ENTRIES_COLLECTION_ID || byName.get('ledger_entries') || '';
};

const hydrateCollections = () => {
  COLLECTIONS.MEMBERS = process.env.MEMBERS_COLLECTION_ID;
  COLLECTIONS.SAVINGS = process.env.SAVINGS_COLLECTION_ID;
  COLLECTIONS.LOANS = process.env.LOANS_COLLECTION_ID;
  COLLECTIONS.LOAN_REPAYMENTS = process.env.LOAN_REPAYMENTS_COLLECTION_ID;
  COLLECTIONS.LOAN_CHARGES = process.env.LOAN_CHARGES_COLLECTION_ID;
  COLLECTIONS.LOAN_GUARANTORS = process.env.LOAN_GUARANTORS_COLLECTION_ID;
  COLLECTIONS.FINANCIAL_CONFIG = process.env.FINANCIAL_CONFIG_COLLECTION_ID;
  COLLECTIONS.LEDGER_ENTRIES = process.env.LEDGER_ENTRIES_COLLECTION_ID || '';
};

const listAllDocuments = async (collectionId, queries = []) => {
  const all = [];
  let cursor = null;
  const limit = 100;

  while (true) {
    const pageQueries = [
      ...queries,
      Query.limit(limit),
      ...(cursor ? [Query.cursorAfter(cursor)] : [])
    ];
    const response = await databases.listDocuments(DATABASE_ID, collectionId, pageQueries);
    all.push(...response.documents);
    if (response.documents.length < limit) break;
    cursor = response.documents[response.documents.length - 1].$id;
  }

  return all;
};

const createMember = async ({ name, email, membershipNumber, authUserId }) => {
  return databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.MEMBERS,
    ID.unique(),
    {
      name,
      email,
      phone: '+256700000000',
      membershipNumber,
      joinDate: new Date().toISOString(),
      status: 'active',
      authUserId
    }
  );
};

const invokeFunctionHandler = async (handler, body, headers = {}) => {
  let responsePayload = null;
  let statusCode = 200;

  const res = {
    json(payload, code = 200) {
      responsePayload = payload;
      statusCode = code;
      return { statusCode, body: payload };
    }
  };

  await handler({
    req: { body: JSON.stringify(body), headers },
    res,
    log: () => {},
    error: () => {}
  });

  if (!responsePayload) {
    throw new Error('Function returned no response payload.');
  }
  if (statusCode >= 400 || responsePayload.success === false) {
    throw new Error(responsePayload.error || `Function call failed with status ${statusCode}`);
  }
  return responsePayload;
};

const main = async () => {
  const missingCore = REQUIRED.filter((key) => !process.env[key]);
  if (missingCore.length > 0) {
    throw new Error(`Missing required env for E2E: ${missingCore.join(', ')}`);
  }

  await resolveCollectionIdsByName();
  hydrateCollections();
  const missingCollections = [
    'MEMBERS_COLLECTION_ID',
    'SAVINGS_COLLECTION_ID',
    'LOANS_COLLECTION_ID',
    'LOAN_REPAYMENTS_COLLECTION_ID',
    'LOAN_CHARGES_COLLECTION_ID',
    'LOAN_GUARANTORS_COLLECTION_ID',
    'FINANCIAL_CONFIG_COLLECTION_ID'
  ].filter((key) => !process.env[key]);
  if (missingCollections.length > 0) {
    throw new Error(`Missing required collection IDs for E2E: ${missingCollections.join(', ')}`);
  }

  const runId = `e2e-${Date.now()}`;
  const monthLabel = new Date().toISOString().slice(0, 7);
  const created = {
    memberIds: [],
    savingIds: [],
    loanId: null
  };

  const adminAuthUserId = `${runId}-admin-auth`;
  const borrowerAuthUserId = `${runId}-borrower-auth`;
  const guarantor1AuthUserId = `${runId}-guarantor1-auth`;
  const guarantor2AuthUserId = `${runId}-guarantor2-auth`;
  process.env.ADMIN_USER_IDS = [process.env.ADMIN_USER_IDS || '', adminAuthUserId]
    .filter(Boolean)
    .join(',');

  const submitHandler = require('../functions/longterm-loan-submit/main.js');
  const guarantorHandler = require('../functions/guarantor-response/main.js');
  const finalApprovalHandler = require('../functions/loan-final-approval/main.js');
  const loanManagementHandler = require('../functions/loan-management/main.js');

  try {
    const borrower = await createMember({
      name: `E2E Borrower ${runId}`,
      email: `${runId}-borrower@example.com`,
      membershipNumber: `E2E-B-${Date.now()}`,
      authUserId: borrowerAuthUserId
    });
    const guarantorA = await createMember({
      name: `E2E Guarantor A ${runId}`,
      email: `${runId}-ga@example.com`,
      membershipNumber: `E2E-GA-${Date.now()}`,
      authUserId: guarantor1AuthUserId
    });
    const guarantorB = await createMember({
      name: `E2E Guarantor B ${runId}`,
      email: `${runId}-gb@example.com`,
      membershipNumber: `E2E-GB-${Date.now()}`,
      authUserId: guarantor2AuthUserId
    });
    created.memberIds.push(borrower.$id, guarantorA.$id, guarantorB.$id);

    const borrowerSaving = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SAVINGS,
      ID.unique(),
      { memberId: borrower.$id, amount: 500000, month: monthLabel, createdAt: new Date().toISOString() }
    );
    const guarantorSavingA = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SAVINGS,
      ID.unique(),
      { memberId: guarantorA.$id, amount: 600000, month: monthLabel, createdAt: new Date().toISOString() }
    );
    const guarantorSavingB = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SAVINGS,
      ID.unique(),
      { memberId: guarantorB.$id, amount: 600000, month: monthLabel, createdAt: new Date().toISOString() }
    );
    created.savingIds.push(borrowerSaving.$id, guarantorSavingA.$id, guarantorSavingB.$id);

    const submitResult = await invokeFunctionHandler(
      submitHandler,
      {
        action: 'submitLongTermLoan',
        amount: 1200000,
        loanType: 'long_term',
        selectedMonths: 6,
        purpose: 'E2E verification loan',
        repaymentType: 'equal',
        termsAccepted: true,
        guarantors: [
          { guarantorId: guarantorA.$id, guaranteeType: 'amount', guaranteedAmount: 400000 },
          { guarantorId: guarantorB.$id, guaranteeType: 'amount', guaranteedAmount: 400000 }
        ]
      },
      { 'x-appwrite-user-id': borrowerAuthUserId }
    );
    assert.equal(submitResult.success, true);
    created.loanId = submitResult.loanId;

    const pendingRequests = await listAllDocuments(COLLECTIONS.LOAN_GUARANTORS, [
      Query.equal('loanId', created.loanId)
    ]);
    assert.equal(pendingRequests.length, 2, 'Expected two guarantor requests');

    const requestA = pendingRequests.find((request) => request.guarantorId === guarantorA.$id);
    const requestB = pendingRequests.find((request) => request.guarantorId === guarantorB.$id);
    assert.ok(requestA && requestB, 'Both guarantor requests must exist');

    await invokeFunctionHandler(
      guarantorHandler,
      { action: 'respondGuarantorRequest', requestId: requestA.$id, response: 'approve' },
      { 'x-appwrite-user-id': guarantor1AuthUserId }
    );
    await invokeFunctionHandler(
      guarantorHandler,
      { action: 'respondGuarantorRequest', requestId: requestB.$id, response: 'approve' },
      { 'x-appwrite-user-id': guarantor2AuthUserId }
    );

    const preApprovedLoan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, created.loanId);
    assert.equal(preApprovedLoan.status, 'pending_admin_approval');
    assert.equal(parseInt(preApprovedLoan.guarantorApprovedAmount, 10), 800000);

    await invokeFunctionHandler(
      finalApprovalHandler,
      { action: 'finalApproveLoan', loanId: created.loanId },
      { 'x-appwrite-user-id': adminAuthUserId }
    );

    const activeLoan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, created.loanId);
    assert.equal(activeLoan.status, 'active');
    assert.equal(parseInt(activeLoan.securedOutstandingTotal, 10), 800000);

    for (let month = 1; month <= 5; month += 1) {
      await invokeFunctionHandler(loanManagementHandler, {
        action: 'recordRepayment',
        loanId: created.loanId,
        month,
        isEarlyPayment: false
      });
    }

    const afterRepaymentsLoan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, created.loanId);
    assert.equal(parseInt(afterRepaymentsLoan.securedOutstandingTotal, 10), 0);
    assert.equal(parseInt(afterRepaymentsLoan.guarantorPrincipalRecoveredTotal, 10), 800000);
    assert.ok(parseInt(afterRepaymentsLoan.borrowerPrincipalRecoveredTotal, 10) > 0);
    assert.equal(afterRepaymentsLoan.repaymentAllocationStatus, 'borrower_priority');

    const guarantorRequests = await listAllDocuments(COLLECTIONS.LOAN_GUARANTORS, [
      Query.equal('loanId', created.loanId),
      Query.equal('status', 'approved')
    ]);
    guarantorRequests.forEach((request) => {
      assert.equal(parseInt(request.securedOutstanding, 10), 0);
    });

    console.log('E2E long-term loan flow verification passed.');
  } finally {
    if (created.loanId) {
      try {
        const repayments = await listAllDocuments(COLLECTIONS.LOAN_REPAYMENTS, [Query.equal('loanId', created.loanId)]);
        for (const repayment of repayments) {
          await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS, repayment.$id);
        }
      } catch {}
      try {
        const charges = await listAllDocuments(COLLECTIONS.LOAN_CHARGES, [Query.equal('loanId', created.loanId)]);
        for (const charge of charges) {
          await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LOAN_CHARGES, charge.$id);
        }
      } catch {}
      try {
        const guarantors = await listAllDocuments(COLLECTIONS.LOAN_GUARANTORS, [Query.equal('loanId', created.loanId)]);
        for (const row of guarantors) {
          await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LOAN_GUARANTORS, row.$id);
        }
      } catch {}
      if (COLLECTIONS.LEDGER_ENTRIES) {
        try {
          const ledgerRows = await listAllDocuments(COLLECTIONS.LEDGER_ENTRIES, [Query.equal('loanId', created.loanId)]);
          for (const row of ledgerRows) {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LEDGER_ENTRIES, row.$id);
          }
        } catch {}
      }
      try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LOANS, created.loanId);
      } catch {}
    }

    for (const savingId of created.savingIds) {
      try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SAVINGS, savingId);
      } catch {}
    }
    for (const memberId of created.memberIds) {
      try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MEMBERS, memberId);
      } catch {}
    }
  }
};

main().catch((error) => {
  console.error('E2E long-term flow verification failed:', error.message);
  process.exit(1);
});
