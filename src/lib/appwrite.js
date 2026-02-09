
//src\lib\appwrite.js
import { Client, Account, Databases, Functions, Storage, Query } from 'appwrite';

const client = new Client();

client
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const functions = new Functions(client);
export const storage = new Storage(client);
export { Query };

export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

export const COLLECTIONS = {
  MEMBERS: '697c8fb200017ff04807',
  SAVINGS: '697c904800100bb6d8ac',
  LOANS: '697c9171001b85d570c2',
  LOAN_REPAYMENTS: '697c929c003aedc62d7f',
  LOAN_CHARGES: '697c9325000805274ae4',
  SUBSCRIPTIONS: '697c9476000289c025df',
  EXPENSES: '697c94ce001de49f1211',
  UNIT_TRUST: '697c956c002816d57a9e',
  INTEREST_ALLOCATIONS: '697c95b9000beba8f806',
  FINANCIAL_CONFIG: import.meta.env.VITE_APPWRITE_FINANCIAL_CONFIG_COLLECTION_ID || '',
  LEDGER_ENTRIES: import.meta.env.VITE_APPWRITE_LEDGER_COLLECTION_ID || '',
  INTEREST_MONTHLY: import.meta.env.VITE_APPWRITE_INTEREST_MONTHLY_COLLECTION_ID || '',
  RETAINED_EARNINGS: import.meta.env.VITE_APPWRITE_RETAINED_EARNINGS_COLLECTION_ID || ''
};

export default client;
