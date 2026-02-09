const sdk = require('node-appwrite');
const { Client, Databases, Query } = sdk;

const client = new Client()
  .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_ID = process.env.DATABASE_ID;
const COLLECTIONS = {
  LOANS: process.env.LOANS_COLLECTION_ID,
  LOAN_CHARGES: process.env.LOAN_CHARGES_COLLECTION_ID,
  LOAN_REPAYMENTS: process.env.LOAN_REPAYMENTS_COLLECTION_ID,
  SAVINGS: process.env.SAVINGS_COLLECTION_ID,
  FINANCIAL_CONFIG: process.env.FINANCIAL_CONFIG_COLLECTION_ID,
  LEDGER_ENTRIES: process.env.LEDGER_ENTRIES_COLLECTION_ID
};

const createLedgerEntry = async ({ type, amount, memberId, loanId, date, notes }) => {
  if (!COLLECTIONS.LEDGER_ENTRIES) return;
  const createdAt = date || new Date().toISOString();
  const month = createdAt.slice(0, 7);
  const year = parseInt(month.split('-')[0], 10);
  await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.LEDGER_ENTRIES,
    sdk.ID.unique(),
    {
      type,
      amount: parseInt(amount) || 0,
      memberId: memberId || null,
      loanId: loanId || null,
      month,
      year,
      createdAt,
      notes: notes || ''
    }
  );
};

const normalizeMemberId = (value) => {
  if (!value) return null;
  return typeof value === 'object' && value.$id ? value.$id : value;
};

const DEFAULT_FINANCIAL_CONFIG = {
  loanInterestRate: 2,
  loanEligibilityPercentage: 80,
  defaultBankCharge: 5000,
  earlyRepaymentPenalty: 1,
  maxLoanDuration: 6,
  minLoanAmount: 10000,
  maxLoanAmount: 5000000
};

async function getFinancialConfig() {
  if (!COLLECTIONS.FINANCIAL_CONFIG) {
    return { ...DEFAULT_FINANCIAL_CONFIG };
  }
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.FINANCIAL_CONFIG,
      [Query.limit(1)]
    );
    if (response.documents.length === 0) {
      const created = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.FINANCIAL_CONFIG,
        sdk.ID.unique(),
        { ...DEFAULT_FINANCIAL_CONFIG }
      );
      return { ...DEFAULT_FINANCIAL_CONFIG, ...created };
    }
    return { ...DEFAULT_FINANCIAL_CONFIG, ...response.documents[0] };
  } catch {
    return { ...DEFAULT_FINANCIAL_CONFIG };
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const { action, ...data } = JSON.parse(req.body);

    switch (action) {
      case 'approveLoan':
        return res.json(await approveLoan(data.loanId));
      case 'rejectLoan':
        return res.json(await rejectLoan(data.loanId));
      case 'addLoanCharge':
        return res.json(await addLoanCharge(data.loanId, data.description, data.amount));
      case 'updateLoanCharge':
        return res.json(await updateLoanCharge(data.chargeId, data.description, data.amount));
      case 'deleteLoanCharge':
        return res.json(await deleteLoanCharge(data.chargeId));
      case 'recordRepayment':
        return res.json(await recordRepayment(data.loanId, data.amount, data.month, data.isEarlyPayment, data.paidAt));
      case 'validateLoanApplication':
        return res.json(await validateLoanApplication(data.loanId));
      default:
        throw new Error('Invalid action');
    }
  } catch (err) {
    error('Function error: ' + err.message);
    return res.json({ success: false, error: err.message }, 400);
  }
};

async function approveLoan(loanId) {
  const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
  const memberId = normalizeMemberId(loan.memberId);
  const config = await getFinancialConfig();
  
  // Validate eligibility
  const memberSavings = await getMemberSavings(memberId);
  const outstandingBalance = await getOutstandingLoanBalance(memberId);
  const maxEligible = memberSavings * (config.loanEligibilityPercentage / 100);
  const availableCredit = Math.max(0, maxEligible - outstandingBalance);
  
  if (loan.amount > availableCredit) {
    throw new Error('Loan amount exceeds 80% of member savings');
  }

  await databases.updateDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId, {
    status: 'active',
    approvedAt: new Date().toISOString(),
    balance: loan.amount
  });

  await createLedgerEntry({
    type: 'LoanDisbursement',
    amount: loan.amount,
    memberId,
    loanId,
    date: new Date().toISOString(),
    notes: 'Loan approved and disbursed'
  });

  return { success: true, message: 'Loan approved and activated successfully' };
}

async function rejectLoan(loanId) {
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId, {
    status: 'rejected',
    rejectedAt: new Date().toISOString()
  });

  return { success: true, message: 'Loan rejected successfully' };
}

async function addLoanCharge(loanId, description, amount) {
  const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
  const memberId = normalizeMemberId(loan.memberId);
  const chargeData = {
    loanId: loanId,
    description: description,
    amount: parseInt(amount),
    createdAt: new Date().toISOString()
  };

  await databases.createDocument(DATABASE_ID, COLLECTIONS.LOAN_CHARGES, sdk.ID.unique(), chargeData);
  await createLedgerEntry({
    type: 'TransferCharge',
    amount: chargeData.amount,
    memberId,
    loanId,
    date: chargeData.createdAt,
    notes: description || 'Loan transfer charge'
  });
  return { success: true, message: 'Bank charge added successfully' };
}

async function updateLoanCharge(chargeId, description, amount) {
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOAN_CHARGES, chargeId);
  const previousAmount = parseInt(existing.amount) || 0;
  await databases.updateDocument(DATABASE_ID, COLLECTIONS.LOAN_CHARGES, chargeId, {
    description: description,
    amount: parseInt(amount)
  });

  const diff = (parseInt(amount) || 0) - previousAmount;
  if (diff !== 0) {
    const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, existing.loanId?.$id || existing.loanId);
    const memberId = normalizeMemberId(loan.memberId);
    await createLedgerEntry({
      type: 'TransferCharge',
      amount: diff,
      memberId,
      loanId: loan.$id,
      date: new Date().toISOString(),
      notes: `Transfer charge adjustment: ${description || 'updated'}`
    });
  }

  return { success: true, message: 'Bank charge updated successfully' };
}

async function deleteLoanCharge(chargeId) {
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOAN_CHARGES, chargeId);
  const amount = parseInt(existing.amount) || 0;
  const loanId = existing.loanId?.$id || existing.loanId;
  const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
  const memberId = normalizeMemberId(loan.memberId);

  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.LOAN_CHARGES, chargeId);

  if (amount !== 0) {
    await createLedgerEntry({
      type: 'TransferCharge',
      amount: -amount,
      memberId,
      loanId,
      date: new Date().toISOString(),
      notes: 'Transfer charge removed'
    });
  }

  return { success: true, message: 'Bank charge removed successfully' };
}

async function recordRepayment(loanId, amount, month, isEarlyPayment = false, paidAt = null) {
  const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
  
  if (loan.status !== 'active') {
    throw new Error('Can only record repayments for active loans');
  }

  const config = await getFinancialConfig();
  const monthNumber = parseInt(month);
  const repaymentPlan = loan.repaymentPlan ? JSON.parse(loan.repaymentPlan) : [];
  const planItem = repaymentPlan.find(item => parseInt(item.month) === monthNumber);
  if (!planItem && !isEarlyPayment) {
    throw new Error('Repayment schedule not found for selected month');
  }

  const chargeResponse = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOAN_CHARGES,
    [Query.equal('loanId', loanId)]
  );
  const bankCharge = chargeResponse.documents.reduce((sum, charge) => sum + (parseInt(charge.amount) || 0), 0);

  const existingRepayments = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOAN_REPAYMENTS,
    [Query.equal('loanId', loanId)]
  );
  const hasFirstMonthRepayment = existingRepayments.documents.some(r => parseInt(r.month) === 1);

  let paymentAmount = 0;
  let principalPaid = 0;
  const currentBalance = loan.balance || loan.amount;

  if (isEarlyPayment) {
    const interestRate = (config.loanInterestRate + config.earlyRepaymentPenalty) / 100;
    const interestAmount = loan.amount * interestRate;
    const chargeAmount = monthNumber === 1 && !hasFirstMonthRepayment ? bankCharge : 0;
    paymentAmount = Math.ceil(currentBalance + interestAmount + chargeAmount);
    principalPaid = currentBalance;
  } else {
    const chargeAmount = monthNumber === 1 && !hasFirstMonthRepayment ? bankCharge : 0;
    paymentAmount = Math.ceil(planItem.payment + chargeAmount);
    principalPaid = planItem.principal;
  }

  // Create repayment record
  const repaymentData = {
    loanId: loanId,
    amount: paymentAmount,
    month: monthNumber,
    paidAt: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
    isEarlyPayment: !!isEarlyPayment
  };

  await databases.createDocument(DATABASE_ID, COLLECTIONS.LOAN_REPAYMENTS, sdk.ID.unique(), repaymentData);
  await createLedgerEntry({
    type: 'LoanRepayment',
    amount: repaymentData.amount,
    memberId: normalizeMemberId(loan.memberId),
    loanId,
    date: repaymentData.paidAt,
    notes: `Repayment month ${monthNumber}`
  });

  // Update loan balance (principal only)
  const newBalance = Math.max(0, currentBalance - principalPaid);
  const status = newBalance === 0 ? 'completed' : 'active';

  await databases.updateDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId, {
    balance: newBalance,
    status: status
  });

  return { 
    success: true, 
    message: 'Repayment recorded successfully',
    newBalance: newBalance,
    status: status
  };
}

async function validateLoanApplication(loanId) {
  const loan = await databases.getDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId);
  const memberId = normalizeMemberId(loan.memberId);
  const config = await getFinancialConfig();
  const memberSavings = await getMemberSavings(memberId);
  const outstandingBalance = await getOutstandingLoanBalance(memberId);
  const maxLoanAmount = memberSavings * (config.loanEligibilityPercentage / 100);
  const availableCredit = Math.max(0, maxLoanAmount - outstandingBalance);
  
  return {
    success: true,
    isEligible: loan.amount <= availableCredit,
    memberSavings: memberSavings,
    maxLoanAmount: maxLoanAmount,
    requestedAmount: loan.amount
  };
}

async function getMemberSavings(memberId) {
  const normalizedId = normalizeMemberId(memberId);
  if (!normalizedId) return 0;
  const savingsResponse = await databases.listDocuments(
    DATABASE_ID, 
    COLLECTIONS.SAVINGS,
    [Query.equal('memberId', normalizedId)]
  );
  
  return savingsResponse.documents.reduce((total, saving) => total + saving.amount, 0);
}

async function getOutstandingLoanBalance(memberId) {
  const normalizedId = normalizeMemberId(memberId);
  if (!normalizedId) return 0;
  const loansResponse = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOANS,
    [Query.equal('memberId', normalizedId)]
  );
  return loansResponse.documents
    .filter(loan => loan.status === 'active')
    .reduce((sum, loan) => sum + (loan.balance || loan.amount), 0);
}
