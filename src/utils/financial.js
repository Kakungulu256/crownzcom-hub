// Convert UGX to display format
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0
  }).format(amount);
};

// Convert display format to UGX integer
export const parseCurrency = (value) => {
  return parseInt(value.toString().replace(/[^\d]/g, '')) || 0;
};

// Calculate loan eligibility (80% of total savings)
export const calculateLoanEligibility = (totalSavings, eligibilityPercent = 0.8) => {
  return Math.floor(totalSavings * eligibilityPercent);
};

// Calculate monthly interest (2% of principal)
export const calculateMonthlyInterest = (principal, monthlyRate = 0.02) => {
  return Math.floor(principal * monthlyRate);
};

// Calculate early repayment interest (extra 1%)
export const calculateEarlyRepaymentInterest = (principal, penaltyRate = 0.01) => {
  return Math.floor(principal * penaltyRate);
};

// Generate repayment schedule
export const generateRepaymentSchedule = (principal, months, customAmounts = null, monthlyRate = 0.02) => {
  const schedule = [];
  
  if (customAmounts) {
    // Custom payment schedule - flat interest rate
    const monthlyInterest = calculateMonthlyInterest(principal, monthlyRate);
    let remainingBalance = principal;
    
    for (let i = 0; i < customAmounts.length; i++) {
      const payment = customAmounts[i];
      const interestAmount = monthlyInterest; // Flat 2% of original principal
      const principalAmount = payment - interestAmount;
      
      remainingBalance = Math.max(0, remainingBalance - principalAmount);
      
      schedule.push({
        month: i + 1,
        payment,
        principal: principalAmount,
        interest: interestAmount,
        balance: remainingBalance
      });
    }
  } else {
    // Equal monthly installments - flat interest rate
    const monthlyInterest = calculateMonthlyInterest(principal, monthlyRate);
    const totalInterest = monthlyInterest * months;
    const totalAmount = principal + totalInterest;
    const monthlyPayment = Math.ceil(totalAmount / months);
    
    let remainingBalance = principal;
    
    for (let i = 0; i < months; i++) {
      const interestAmount = monthlyInterest; // Flat 2% of original principal
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
  }
  
  return schedule;
};

// Format date for display
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-UG');
};

// Calculate available credit (eligibility minus active loans)
export const calculateAvailableCredit = (totalSavings, activeLoans = 0, eligibilityPercent = 0.8) => {
  const maxEligible = calculateLoanEligibility(totalSavings, eligibilityPercent);
  return Math.max(0, maxEligible - activeLoans);
};

// Validate loan application
export const validateLoanApplication = (amount, totalSavings, existingLoans = 0, eligibilityPercent = 0.8) => {
  const maxEligible = calculateLoanEligibility(totalSavings, eligibilityPercent);
  const availableCredit = calculateAvailableCredit(totalSavings, existingLoans, eligibilityPercent);
  const requestedAmount = parseInt(amount) || 0;
  
  return {
    isValid: requestedAmount <= availableCredit,
    maxEligible,
    currentExposure: existingLoans,
    requestedAmount,
    availableCredit,
    totalExposure: existingLoans + requestedAmount
  };
};
