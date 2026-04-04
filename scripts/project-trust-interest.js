const sdk = require('node-appwrite');

const {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  LOANS_COLLECTION_ID,
  LOAN_REPAYMENTS_COLLECTION_ID,
  UNIT_TRUST_COLLECTION_ID,
  VITE_APPWRITE_ENDPOINT,
  VITE_APPWRITE_PROJECT_ID,
  VITE_APPWRITE_API_KEY,
  VITE_APPWRITE_DATABASE_ID,
  VITE_APPWRITE_LOANS_COLLECTION_ID,
  VITE_APPWRITE_LOAN_REPAYMENTS_COLLECTION_ID,
  VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID
} = process.env;

const endpoint = APPWRITE_ENDPOINT || VITE_APPWRITE_ENDPOINT;
const projectId = APPWRITE_PROJECT_ID || VITE_APPWRITE_PROJECT_ID;
const apiKey = APPWRITE_API_KEY || VITE_APPWRITE_API_KEY;
const databaseId = DATABASE_ID || VITE_APPWRITE_DATABASE_ID;

const loansCollectionId = LOANS_COLLECTION_ID || VITE_APPWRITE_LOANS_COLLECTION_ID || 'loans';
const repaymentsCollectionId = LOAN_REPAYMENTS_COLLECTION_ID || VITE_APPWRITE_LOAN_REPAYMENTS_COLLECTION_ID || 'loan_repayments';
const unitTrustCollectionId = UNIT_TRUST_COLLECTION_ID || VITE_APPWRITE_UNIT_TRUST_COLLECTION_ID || 'unit_trust';

if (!endpoint || !projectId || !apiKey || !databaseId) {
  console.error('Missing required env vars: APPWRITE_ENDPOINT/PROJECT_ID/API_KEY/DATABASE_ID or VITE_APPWRITE_* equivalents');
  process.exit(1);
}

const MONTHLY_RATE = 0.01;
const START_MONTH = '2026-03';
const END_MONTH = '2026-12';
const BASELINE_CUTOFF = '2026-02-28';
const MIN_SAVINGS = 510000;
const MAX_SAVINGS = 645000;

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

function toMonthKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function addMonths(monthKey, delta) {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(Date.UTC(year, month, 1));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(start, end) {
  const months = [];
  let current = start;
  while (current <= end) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function normalizeLoanId(value) {
  if (!value) return null;
  return typeof value === 'object' && value.$id ? value.$id : value;
}

function getAnchorMonth(loan, repayments) {
  if (repayments.length > 0) {
    const counts = new Map();
    repayments.forEach((repayment) => {
      const paidAt = repayment.paidAt || repayment.createdAt;
      const paidMonth = toMonthKey(paidAt);
      const monthNumber = parseInt(repayment.month, 10) || 1;
      if (!paidMonth) return;
      const anchor = addMonths(paidMonth, -(monthNumber - 1));
      counts.set(anchor, (counts.get(anchor) || 0) + 1);
    });
    if (counts.size > 0) {
      const sorted = Array.from(counts.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      });
      return sorted[0][0];
    }
  }

  const createdMonth = toMonthKey(loan.createdAt || loan.$createdAt);
  return createdMonth ? addMonths(createdMonth, 1) : START_MONTH;
}

function buildScheduledRepayments(loans, repayments) {
  const repaymentMap = new Map();

  loans.forEach((loan) => {
    if (!loan?.repaymentPlan) return;
    if (!['active', 'approved'].includes(loan.status)) return;

    let schedule = [];
    try {
      schedule = JSON.parse(loan.repaymentPlan) || [];
    } catch {
      schedule = [];
    }
    if (!Array.isArray(schedule) || schedule.length === 0) return;

    const loanRepayments = repayments.filter(
      (repayment) => normalizeLoanId(repayment.loanId) === loan.$id
    );
    const anchorMonth = getAnchorMonth(loan, loanRepayments);

    schedule.forEach((item) => {
      const monthNumber = parseInt(item.month, 10);
      if (!monthNumber) return;
      const dueMonth = addMonths(anchorMonth, monthNumber - 1);
      const payment = parseInt(item.payment ?? item.amount, 10) || 0;
      if (!payment) return;
      repaymentMap.set(dueMonth, (repaymentMap.get(dueMonth) || 0) + payment);
    });
  });

  return repaymentMap;
}

async function main() {
  const [unitTrust, loans, repayments] = await Promise.all([
    listAllDocuments(unitTrustCollectionId),
    listAllDocuments(loansCollectionId),
    listAllDocuments(repaymentsCollectionId)
  ]);

  const baselineDate = BASELINE_CUTOFF;
  const trustAsOf = unitTrust.filter((record) => {
    const recordDate = record.date || record.createdAt || record.$createdAt;
    const dateKey = toDateKey(recordDate);
    return dateKey && dateKey <= baselineDate;
  });

  const totalInvested = trustAsOf
    .filter((record) => String(record.type || '').toLowerCase() === 'purchase')
    .reduce((sum, record) => sum + (record.amountFloat ?? record.amount ?? 0), 0);
  const totalWithdrawn = trustAsOf
    .filter((record) => String(record.type || '').toLowerCase() === 'withdrawal')
    .reduce((sum, record) => sum + (record.amountFloat ?? record.amount ?? 0), 0);
  const totalTrustInterest = trustAsOf
    .filter((record) => String(record.type || '').toLowerCase() === 'interest')
    .reduce((sum, record) => sum + (record.amountFloat ?? record.amount ?? 0), 0);

  const openingBalance = totalInvested + totalTrustInterest - totalWithdrawn;
  const scheduleMap = buildScheduledRepayments(loans, repayments);

  const months = monthRange(START_MONTH, END_MONTH);
  const scenarios = [
    { label: 'Min Savings', savings: MIN_SAVINGS },
    { label: 'Max Savings', savings: MAX_SAVINGS }
  ];

  console.log('Trust Interest Projection (As of Feb 28th 2026)');
  console.log(`Opening Trust Balance: ${formatAmount(openingBalance)}`);
  console.log(`Trust Interest Earned (As of Feb 28th 2026): ${formatAmount(totalTrustInterest)}`);
  console.log('');

  scenarios.forEach((scenario) => {
    let balance = openingBalance;
    let totalInterest = 0;

    console.log(`Scenario: ${scenario.label} (Savings ${scenario.savings.toLocaleString('en-US')}/month)`);
    console.log('Month | Loan Repayments | Savings | Total Inflow | Interest | Closing Balance');

    months.forEach((monthKey) => {
      const repaymentsForMonth = scheduleMap.get(monthKey) || 0;
      const inflow = repaymentsForMonth + scenario.savings;
      const interest = (balance + inflow) * MONTHLY_RATE;
      const closing = balance + inflow + interest;

      totalInterest += interest;

      console.log(
        `${monthKey} | ${formatAmount(repaymentsForMonth)} | ${formatAmount(scenario.savings)} | ${formatAmount(inflow)} | ${formatAmount(interest)} | ${formatAmount(closing)}`
      );

      balance = closing;
    });

    console.log(`Total Interest (Mar-Dec 2026): ${formatAmount(totalInterest)}`);
    console.log(`Closing Balance (Dec 2026): ${formatAmount(balance)}`);
    console.log('');
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
