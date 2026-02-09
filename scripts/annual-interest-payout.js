const sdk = require('node-appwrite');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  LEDGER_COLLECTION_ID,
  MEMBERS_COLLECTION_ID,
  VITE_APPWRITE_LEDGER_COLLECTION_ID,
  VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_API_KEY,
  VITE_APPWRITE_DATABASE_ID,
  VITE_APPWRITE_MEMBERS_COLLECTION_ID
} = process.env;

const endpoint = APPWRITE_ENDPOINT || VITE_APPWRITE_ENDPOINT;
const projectId = APPWRITE_PROJECT_ID || VITE_APPWRITE_PROJECT_ID;
const apiKey = APPWRITE_API_KEY || VITE_APPWRITE_API_KEY;
const databaseId = DATABASE_ID || VITE_APPWRITE_DATABASE_ID;
const ledgerCollectionId = LEDGER_COLLECTION_ID || VITE_APPWRITE_LEDGER_COLLECTION_ID;
const membersCollectionId = MEMBERS_COLLECTION_ID || VITE_APPWRITE_MEMBERS_COLLECTION_ID;

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents');
  process.exit(1);
}

if (!ledgerCollectionId || !membersCollectionId) {
  console.error('Missing required env vars: LEDGER_COLLECTION_ID and MEMBERS_COLLECTION_ID');
  process.exit(1);
}

const yearArg = process.argv[2];
if (!yearArg || !/^\d{4}$/.test(yearArg)) {
  console.error('Usage: node scripts/annual-interest-payout.js YYYY');
  process.exit(1);
}

const year = parseInt(yearArg, 10);

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

async function getAccruals() {
  return listAllDocuments(
    ledgerCollectionId,
    [
      sdk.Query.equal('year', year),
      sdk.Query.equal('type', ['LoanInterestAccrual', 'TrustInterestAccrual'])
    ]
  );
}

async function getExistingPayouts() {
  const existing = await listAllDocuments(
    ledgerCollectionId,
    [
      sdk.Query.equal('year', year),
      sdk.Query.equal('type', ['InterestPayout'])
    ]
  );
  return new Set(existing.map((entry) => entry.memberId));
}

async function main() {
  const [members, accruals, existingPayouts] = await Promise.all([
    listAllDocuments(membersCollectionId),
    getAccruals(),
    getExistingPayouts()
  ]);

  const totalsByMember = new Map();
  accruals.forEach((entry) => {
    if (!entry.memberId) return;
    const current = totalsByMember.get(entry.memberId) || 0;
    totalsByMember.set(entry.memberId, current + (entry.amount || 0));
  });

  const createdAt = new Date().toISOString();
  let created = 0;

  for (const member of members) {
    const memberId = member.$id;
    const total = totalsByMember.get(memberId) || 0;
    if (total <= 0) continue;
    if (existingPayouts.has(memberId)) continue;

    await databases.createDocument(
      databaseId,
      ledgerCollectionId,
      sdk.ID.unique(),
      {
        type: 'InterestPayout',
        amount: total,
        memberId,
        year,
        createdAt,
        notes: `Annual interest payout for ${year}`
      }
    );
    created += 1;
  }

  console.log(`Interest payouts created: ${created}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
