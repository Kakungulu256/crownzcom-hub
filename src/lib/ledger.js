import { ID } from 'appwrite';

export const createLedgerEntry = async ({ databases, DATABASE_ID, COLLECTIONS, entry }) => {
  if (!COLLECTIONS?.LEDGER_ENTRIES) {
    return null;
  }

  const payload = {
    type: entry.type,
    amount: entry.amount,
    memberId: entry.memberId || null,
    loanId: entry.loanId || null,
    month: entry.month || null,
    year: entry.year || null,
    createdAt: entry.createdAt || new Date().toISOString(),
    notes: entry.notes || ''
  };

  try {
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.LEDGER_ENTRIES,
      ID.unique(),
      payload
    );
  } catch (error) {
    console.error('Failed to write ledger entry', error);
    return null;
  }
};
