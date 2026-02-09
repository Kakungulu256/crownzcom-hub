const sdk = require('node-appwrite');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  MEMBERS_COLLECTION_ID,
  LOANS_COLLECTION_ID,
  FINANCIAL_CONFIG_COLLECTION_ID
} = process.env;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY || !DATABASE_ID) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, DATABASE_ID');
  process.exit(1);
}

const client = new sdk.Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const users = new sdk.Users(client);
const databases = new sdk.Databases(client);

const DEFAULT_FINANCIAL_CONFIG = {
  loanInterestRate: 2,
  loanEligibilityPercentage: 80,
  defaultBankCharge: 5000,
  earlyRepaymentPenalty: 1,
  maxLoanDuration: 6,
  minLoanAmount: 10000,
  maxLoanAmount: 5000000
};

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
    const response = await databases.listDocuments(DATABASE_ID, collectionId, pageQueries);
    all.push(...response.documents);
    if (response.documents.length < limit) break;
    cursor = response.documents[response.documents.length - 1].$id;
  }

  return all;
}

function normalizeMemberId(value) {
  if (!value) return null;
  return typeof value === 'object' && value.$id ? value.$id : value;
}

function generateRepaymentSchedule(principal, months, monthlyRate) {
  const schedule = [];
  const monthlyInterest = Math.floor(principal * monthlyRate);
  const totalInterest = monthlyInterest * months;
  const totalAmount = principal + totalInterest;
  const monthlyPayment = Math.ceil(totalAmount / months);
  let remainingBalance = principal;

  for (let i = 0; i < months; i++) {
    const interestAmount = monthlyInterest;
    const principalAmount = monthlyPayment - interestAmount;
    remainingBalance = Math.max(0, remainingBalance - principalAmount);
    schedule.push({
      month: i + 1,
      payment: monthlyPayment,
      principal: principalAmount,
      interest: interestAmount,
      balance: remainingBalance
    });
  }
  return schedule;
}

async function ensureFinancialConfig() {
  if (!FINANCIAL_CONFIG_COLLECTION_ID) {
    console.warn('FINANCIAL_CONFIG_COLLECTION_ID not set. Skipping config creation.');
    return DEFAULT_FINANCIAL_CONFIG;
  }
  const existing = await databases.listDocuments(
    DATABASE_ID,
    FINANCIAL_CONFIG_COLLECTION_ID,
    [sdk.Query.limit(1)]
  );
  if (existing.documents.length > 0) {
    return { ...DEFAULT_FINANCIAL_CONFIG, ...existing.documents[0] };
  }
  const created = await databases.createDocument(
    DATABASE_ID,
    FINANCIAL_CONFIG_COLLECTION_ID,
    sdk.ID.unique(),
    { ...DEFAULT_FINANCIAL_CONFIG }
  );
  return { ...DEFAULT_FINANCIAL_CONFIG, ...created };
}

async function backfillAuthUserId() {
  if (!MEMBERS_COLLECTION_ID) {
    console.warn('MEMBERS_COLLECTION_ID not set. Skipping member backfill.');
    return;
  }

  const members = await listAllDocuments(MEMBERS_COLLECTION_ID);
  const usersResponse = await users.list();
  const usersByEmail = new Map(usersResponse.users.map(user => [user.email, user]));

  let updated = 0;
  for (const member of members) {
    if (member.authUserId) continue;
    const user = usersByEmail.get(member.email);
    if (!user) continue;
    await databases.updateDocument(
      DATABASE_ID,
      MEMBERS_COLLECTION_ID,
      member.$id,
      { authUserId: user.$id }
    );
    updated += 1;
  }
  console.log(`Members updated with authUserId: ${updated}`);
}

async function backfillLoanBalancesAndPlans(config) {
  if (!LOANS_COLLECTION_ID) {
    console.warn('LOANS_COLLECTION_ID not set. Skipping loans backfill.');
    return;
  }
  const loans = await listAllDocuments(LOANS_COLLECTION_ID);
  const monthlyRate = (config.loanInterestRate || 2) / 100;
  let updated = 0;

  for (const loan of loans) {
    const updates = {};
    if (loan.balance === undefined || loan.balance === null) {
      updates.balance = loan.amount;
    }
    if (!loan.repaymentPlan) {
      const schedule = generateRepaymentSchedule(
        loan.amount,
        loan.duration || 1,
        monthlyRate
      );
      updates.repaymentPlan = JSON.stringify(schedule);
    }
    if (Object.keys(updates).length > 0) {
      await databases.updateDocument(DATABASE_ID, LOANS_COLLECTION_ID, loan.$id, updates);
      updated += 1;
    }
  }
  console.log(`Loans updated (balance/repaymentPlan): ${updated}`);
}

async function main() {
  const config = await ensureFinancialConfig();
  await backfillAuthUserId();
  await backfillLoanBalancesAndPlans(config);
  console.log('Migration complete.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
