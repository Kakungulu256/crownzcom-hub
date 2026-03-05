const sdk = require('node-appwrite');
const { Client, Databases, Query } = sdk;
const { allocateProRataByOutstanding } = require('./waterfall');
const {
  INTEREST_CALCULATION_MODES,
  normalizeInterestCalculationMode,
  calculateScheduledInterest,
  calculateEarlyPayoffInterest
} = require('../shared/loan-calculations');

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
  LOAN_GUARANTORS: process.env.LOAN_GUARANTORS_COLLECTION_ID,
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

const toInteger = (value, fallback = 0) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function listAllDocuments(collectionId, queries = []) {
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
}

function getLoanMonthlyRate(loan, config) {
  const storedPercent = toFloat(loan.monthlyInterestRateApplied, NaN);
  if (Number.isFinite(storedPercent) && storedPercent >= 0) {
    return storedPercent / 100;
  }

  return loan.loanType === 'long_term'
    ? toFloat(config.longTermInterestRate, 1.5) / 100
    : toFloat(config.loanInterestRate, 2) / 100;
}

function getLoanCalculationContext(loan, config) {
  return {
    mode: normalizeInterestCalculationMode(
      loan.interestCalculationModeApplied || config.interestCalculationMode
    ),
    monthlyRate: getLoanMonthlyRate(loan, config)
  };
}

const DEFAULT_FINANCIAL_CONFIG = {
  loanInterestRate: 2,
  longTermInterestRate: 1.5,
  interestCalculationMode: 'flat',
  loanEligibilityPercentage: 80,
  defaultBankCharge: 5000,
  earlyRepaymentPenalty: 1,
  maxLoanDuration: 6,
  longTermMaxRepaymentMonths: 24,
  minLoanAmount: 10000,
  maxLoanAmount: 5000000
};

const parseBody = (body) => {
  if (!body) return {};
  if (typeof body === 'string') {
    return JSON.parse(body);
  }
  return body;
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
    const { action, ...data } = parseBody(req.body);

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
  const monthNumber = toInteger(month, 0);
  if (monthNumber <= 0) {
    throw new Error('Invalid repayment month');
  }
  const repaymentPlan = loan.repaymentPlan ? JSON.parse(loan.repaymentPlan) : [];
  const planItem = repaymentPlan.find(item => toInteger(item.month, 0) === monthNumber);
  if (!planItem && !isEarlyPayment) {
    throw new Error('Repayment schedule not found for selected month');
  }

  const chargeResponse = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOAN_CHARGES,
    [Query.equal('loanId', loanId)]
  );
  const bankCharge = chargeResponse.documents.reduce((sum, charge) => sum + toInteger(charge.amount, 0), 0);

  const existingRepayments = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.LOAN_REPAYMENTS,
    [Query.equal('loanId', loanId)]
  );
  const hasFirstMonthRepayment = existingRepayments.documents.some(r => toInteger(r.month, 0) === 1);

  let paymentAmount = 0;
  let principalPaid = 0;
  let interestPaid = 0;
  const currentBalance = Math.max(0, toInteger(loan.balance ?? loan.amount, 0));
  const { mode: interestCalculationMode, monthlyRate } = getLoanCalculationContext(loan, config);
  const earlyPenaltyRate = toFloat(config.earlyRepaymentPenalty, 1) / 100;

  if (isEarlyPayment) {
    const interestBreakdown = calculateEarlyPayoffInterest({
      loanAmount: loan.amount,
      currentBalance,
      monthlyRate,
      earlyPenaltyRate,
      interestCalculationMode
    });
    const interestAmount = interestBreakdown.totalInterest;
    const chargeAmount = monthNumber === 1 && !hasFirstMonthRepayment ? bankCharge : 0;
    paymentAmount = Math.ceil(currentBalance + interestAmount + chargeAmount);
    principalPaid = currentBalance;
    interestPaid = interestAmount;
  } else {
    const scheduledPayment = toInteger(planItem.payment ?? planItem.amount, 0);
    const scheduledInterest = calculateScheduledInterest({
      loanAmount: loan.amount,
      planItem,
      currentBalance,
      monthlyRate,
      interestCalculationMode
    });
    const netWithoutCharges = Math.max(0, scheduledPayment);
    const normalizedInterest = Math.min(Math.max(0, scheduledInterest), netWithoutCharges);
    const scheduledPrincipal = Math.max(
      0,
      toInteger(planItem.principal, netWithoutCharges - normalizedInterest)
    );
    const chargeAmount = monthNumber === 1 && !hasFirstMonthRepayment ? bankCharge : 0;
    paymentAmount = Math.ceil(netWithoutCharges + chargeAmount);
    interestPaid = normalizedInterest;
    principalPaid = Math.max(0, Math.min(currentBalance, netWithoutCharges - interestPaid, scheduledPrincipal));
  }

  // Create repayment record
  const repaymentTimestamp = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();
  const repaymentData = {
    loanId: loanId,
    amount: paymentAmount,
    month: monthNumber,
    paidAt: repaymentTimestamp,
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

  let guarantorPrincipalAllocation = 0;
  let borrowerPrincipalAllocation = principalPaid;

  const existingGuarantorRecovered = toInteger(loan.guarantorPrincipalRecoveredTotal, 0);
  const existingBorrowerRecovered = toInteger(loan.borrowerPrincipalRecoveredTotal, 0);
  const existingSecuredOriginalTotal = toInteger(loan.securedOriginalTotal, 0);
  const hasGuarantorWorkflow = Boolean(loan.guarantorRequired) || existingSecuredOriginalTotal > 0;
  let securedOutstandingTotal = toInteger(loan.securedOutstandingTotal, 0);
  let settlementCompletedAt = loan.guarantorSettlementCompletedAt || null;

  if (hasGuarantorWorkflow && COLLECTIONS.LOAN_GUARANTORS) {
    const approvedRequests = await listAllDocuments(
      COLLECTIONS.LOAN_GUARANTORS,
      [Query.equal('loanId', loanId), Query.equal('status', 'approved')]
    );

    const requestOutstandingTotal = approvedRequests.reduce(
      (sum, request) =>
        sum + toInteger(request.securedOutstanding ?? request.approvedAmount ?? request.guaranteedAmount, 0),
      0
    );
    const securedOutstandingBefore = Math.max(0, requestOutstandingTotal);
    securedOutstandingTotal = securedOutstandingBefore;

    if (securedOutstandingBefore > 0 && principalPaid > 0) {
      const allocation = allocateProRataByOutstanding(approvedRequests, principalPaid);
      guarantorPrincipalAllocation = allocation.allocatable;
      borrowerPrincipalAllocation = Math.max(0, principalPaid - guarantorPrincipalAllocation);

      if (allocation.allocations.length > 0) {
        await Promise.all(
          allocation.allocations.map((item) =>
            databases.updateDocument(
              DATABASE_ID,
              COLLECTIONS.LOAN_GUARANTORS,
              item.requestId,
              {
                securedOutstanding: item.nextOutstanding,
                updatedAt: repaymentTimestamp
              }
            )
          )
        );
      }

      securedOutstandingTotal = Math.max(0, securedOutstandingBefore - guarantorPrincipalAllocation);
      if (securedOutstandingBefore > 0 && securedOutstandingTotal === 0 && !settlementCompletedAt) {
        settlementCompletedAt = repaymentTimestamp;
      }
    } else {
      borrowerPrincipalAllocation = principalPaid;
      if (securedOutstandingBefore === 0 && !settlementCompletedAt && existingSecuredOriginalTotal > 0) {
        settlementCompletedAt = repaymentTimestamp;
      }
    }
  }

  // Keep loan financial balance tied to total principal repayment.
  const newBalance = Math.max(0, currentBalance - principalPaid);
  const status = newBalance === 0 ? 'completed' : 'active';
  const repaymentAllocationStatus = !hasGuarantorWorkflow
    ? 'not_required'
    : securedOutstandingTotal > 0
      ? 'guarantor_priority'
      : 'borrower_priority';

  const loanUpdates = {
    balance: newBalance,
    status: status,
    guarantorPrincipalRecoveredTotal: existingGuarantorRecovered + guarantorPrincipalAllocation,
    borrowerPrincipalRecoveredTotal: existingBorrowerRecovered + borrowerPrincipalAllocation,
    securedOutstandingTotal: hasGuarantorWorkflow ? securedOutstandingTotal : 0,
    repaymentAllocationStatus,
    lastRepaymentAllocationAt: repaymentTimestamp
  };
  if (settlementCompletedAt) {
    loanUpdates.guarantorSettlementCompletedAt = settlementCompletedAt;
  }

  await databases.updateDocument(DATABASE_ID, COLLECTIONS.LOANS, loanId, loanUpdates);

  return { 
    success: true, 
    message: 'Repayment recorded successfully',
    newBalance: newBalance,
    status: status,
    allocation: {
      interestPaid,
      principalPaid,
      guarantorPrincipalAllocation,
      borrowerPrincipalAllocation,
      securedOutstandingTotal,
      repaymentAllocationStatus,
      interestCalculationMode,
      monthlyRateApplied: Number((monthlyRate * 100).toFixed(6))
    }
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
