const sdk = require('node-appwrite');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  LEDGER_COLLECTION_ID,
  INTEREST_MONTHLY_COLLECTION_ID,
  RETAINED_EARNINGS_COLLECTION_ID,
  MEMBERS_COLLECTION_ID,
  SAVINGS_COLLECTION_ID,
  VITE_APPWRITE_LEDGER_COLLECTION_ID,
  VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID,
  VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID,
  VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_API_KEY,
  VITE_APPWRITE_DATABASE_ID
} = process.env;

const endpoint = APPWRITE_ENDPOINT || VITE_APPWRITE_ENDPOINT;
const projectId = APPWRITE_PROJECT_ID || VITE_APPWRITE_PROJECT_ID;
const apiKey = APPWRITE_API_KEY || VITE_APPWRITE_API_KEY;
const databaseId = DATABASE_ID || VITE_APPWRITE_DATABASE_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents');
  process.exit(1);
}

const ledgerCollectionId = LEDGER_COLLECTION_ID || VITE_APPWRITE_LEDGER_COLLECTION_ID;
const interestMonthlyCollectionId = INTEREST_MONTHLY_COLLECTION_ID || VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID;
const retainedEarningsCollectionId = RETAINED_EARNINGS_COLLECTION_ID || VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID;

if (!ledgerCollectionId || !interestMonthlyCollectionId || !retainedEarningsCollectionId) {
  console.error('Missing required env vars: LEDGER_COLLECTION_ID, INTEREST_MONTHLY_COLLECTION_ID, RETAINED_EARNINGS_COLLECTION_ID');
  process.exit(1);
}

const membersCollectionId = MEMBERS_COLLECTION_ID || process.env.VITE_APPWRITE_MEMBERS_COLLECTION_ID;
const savingsCollectionId = SAVINGS_COLLECTION_ID || process.env.VITE_APPWRITE_SAVINGS_COLLECTION_ID;

if (!membersCollectionId || !savingsCollectionId) {
  console.error('Missing required env vars: MEMBERS_COLLECTION_ID, SAVINGS_COLLECTION_ID');
  process.exit(1);
}

const monthArg = process.argv[2];
if (!monthArg || !/^\d{4}-\d{2}$/.test(monthArg)) {
  console.error('Usage: node scripts/accrue-monthly-interest.js YYYY-MM');
  process.exit(1);
}

const year = parseInt(monthArg.split('-')[0], 10);

const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const databases = new sdk.Databases(client);

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

async function getRetainedPercentage() {
  const retainedDocs = await databases.listDocuments(
    databaseId,
    retainedEarningsCollectionId,
    [sdk.Query.equal('year', year), sdk.Query.limit(1)]
  );
  if (retainedDocs.documents.length === 0) return 0;
  const pct = retainedDocs.documents[0].percentage;
  return typeof pct === 'number' ? pct : parseFloat(pct || 0);
}

function allocateEvenly(total, memberIds) {
  if (memberIds.length === 0 || total <= 0) {
    return new Map();
  }
  const base = Math.floor(total / memberIds.length);
  const remainder = total - base * memberIds.length;
  const allocations = new Map();
  memberIds.forEach((id, idx) => {
    allocations.set(id, base + (idx < remainder ? 1 : 0));
  });
  return allocations;
}

function allocateByWeight(total, weights) {
  const entries = Array.from(weights.entries());
  if (entries.length === 0 || total <= 0) return new Map();
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight === 0) return new Map();

  const allocations = new Map();
  let allocated = 0;
  entries.forEach(([id, weight]) => {
    const share = Math.floor((total * weight) / totalWeight);
    allocations.set(id, share);
    allocated += share;
  });

  let remainder = total - allocated;
  if (remainder > 0) {
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    let idx = 0;
    while (remainder > 0 && sorted.length > 0) {
      const targetId = sorted[idx % sorted.length][0];
      allocations.set(targetId, (allocations.get(targetId) || 0) + 1);
      remainder -= 1;
      idx += 1;
    }
  }
  return allocations;
}

async function ensureInterestRecord() {
  const interestDocs = await databases.listDocuments(
    databaseId,
    interestMonthlyCollectionId,
    [sdk.Query.equal('month', monthArg), sdk.Query.limit(1)]
  );
  if (interestDocs.documents.length === 0) {
    console.error(`No interest_monthly record found for ${monthArg}`);
    process.exit(1);
  }
  return interestDocs.documents[0];
}

async function getExistingAccruals() {
  const existing = await listAllDocuments(
    ledgerCollectionId,
    [
      sdk.Query.equal('month', monthArg),
      sdk.Query.equal('type', ['LoanInterestAccrual', 'TrustInterestAccrual'])
    ]
  );
  const keySet = new Set(
    existing.map((entry) => `${entry.type}:${entry.memberId}`)
  );
  return keySet;
}

async function createLedgerEntry(data) {
  await databases.createDocument(
    databaseId,
    ledgerCollectionId,
    sdk.ID.unique(),
    data
  );
}

async function main() {
  const [interestRecord, retainedPct, members, savings, existingKeys] = await Promise.all([
    ensureInterestRecord(),
    getRetainedPercentage(),
    listAllDocuments(membersCollectionId),
    listAllDocuments(savingsCollectionId, [sdk.Query.equal('month', monthArg)]),
    getExistingAccruals()
  ]);

  const retainedFactor = Math.max(0, 1 - (retainedPct || 0) / 100);
  const loanPool = Math.max(0, Math.floor((interestRecord.loanInterestTotal || 0) * retainedFactor));
  const trustPool = Math.max(0, Math.floor((interestRecord.trustInterestTotal || 0) * retainedFactor));

  const memberIds = members.map((member) => member.$id);
  const loanAllocations = allocateEvenly(loanPool, memberIds);

  const savingsByMember = new Map();
  savings.forEach((saving) => {
    if (!saving.memberId) return;
    const memberId = typeof saving.memberId === 'object' && saving.memberId.$id ? saving.memberId.$id : saving.memberId;
    const current = savingsByMember.get(memberId) || 0;
    savingsByMember.set(memberId, current + (saving.amount || 0));
  });

  const trustAllocations = allocateByWeight(trustPool, savingsByMember);

  const createdAt = new Date().toISOString();
  let createdCount = 0;

  for (const memberId of memberIds) {
    const loanAmount = loanAllocations.get(memberId) || 0;
    if (loanAmount > 0 && !existingKeys.has(`LoanInterestAccrual:${memberId}`)) {
      await createLedgerEntry({
        type: 'LoanInterestAccrual',
        amount: loanAmount,
        memberId,
        month: monthArg,
        year,
        createdAt,
        notes: `Loan interest accrual for ${monthArg}`
      });
      createdCount += 1;
    }

    const trustAmount = trustAllocations.get(memberId) || 0;
    if (trustAmount > 0 && !existingKeys.has(`TrustInterestAccrual:${memberId}`)) {
      await createLedgerEntry({
        type: 'TrustInterestAccrual',
        amount: trustAmount,
        memberId,
        month: monthArg,
        year,
        createdAt,
        notes: `Trust interest accrual for ${monthArg}`
      });
      createdCount += 1;
    }
  }

  console.log(`Accruals created: ${createdCount}`);
  console.log(`Loan pool: ${loanPool}, Trust pool: ${trustPool}, Retained %: ${retainedPct || 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
