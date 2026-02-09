import { Query } from './appwrite';
import { ID } from 'appwrite';

export const DEFAULT_FINANCIAL_CONFIG = {
  loanInterestRate: 2,
  loanEligibilityPercentage: 80,
  defaultBankCharge: 5000,
  earlyRepaymentPenalty: 1,
  maxLoanDuration: 6,
  minLoanAmount: 10000,
  maxLoanAmount: 5000000
};

export const fetchFinancialConfig = async (databases, databaseId, collectionId, options = {}) => {
  const createIfMissing = options.createIfMissing || false;
  if (!collectionId) {
    return { ...DEFAULT_FINANCIAL_CONFIG };
  }

  try {
    const response = await databases.listDocuments(
      databaseId,
      collectionId,
      [Query.limit(1)]
    );

    if (response.documents.length === 0) {
      if (createIfMissing) {
        const created = await databases.createDocument(
          databaseId,
          collectionId,
          ID.unique(),
          { ...DEFAULT_FINANCIAL_CONFIG }
        );
        return { ...DEFAULT_FINANCIAL_CONFIG, ...created };
      }
      return { ...DEFAULT_FINANCIAL_CONFIG };
    }

    return { ...DEFAULT_FINANCIAL_CONFIG, ...response.documents[0] };
  } catch {
    return { ...DEFAULT_FINANCIAL_CONFIG };
  }
};
