const assert = require('node:assert/strict');
const {
  INTEREST_CALCULATION_MODES,
  normalizeInterestCalculationMode,
  generateRepaymentSchedule,
  calculateScheduledInterest,
  calculateEarlyPayoffInterest
} = require('../functions/shared/loan-calculations');

function sumBy(items, key) {
  return items.reduce((sum, row) => sum + (parseInt(row[key], 10) || 0), 0);
}

function testNormalizeMode() {
  assert.equal(
    normalizeInterestCalculationMode('flat'),
    INTEREST_CALCULATION_MODES.FLAT
  );
  assert.equal(
    normalizeInterestCalculationMode('reducing_balance'),
    INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  );
  assert.equal(
    normalizeInterestCalculationMode('invalid-mode'),
    INTEREST_CALCULATION_MODES.FLAT
  );
}

function testFlatEqualSchedule() {
  const schedule = generateRepaymentSchedule({
    principal: 1200000,
    months: 6,
    monthlyRate: 0.02,
    interestCalculationMode: INTEREST_CALCULATION_MODES.FLAT
  });

  assert.equal(schedule.length, 6);
  assert.ok(schedule.every((item) => item.interest === 24000));
  assert.ok(schedule.every((item) => item.payment === 224000));
  assert.equal(schedule[0].principal, 200000);
  assert.equal(schedule[schedule.length - 1].balance, 0);
  assert.equal(sumBy(schedule, 'interest'), 144000);
}

function testReducingEqualSchedule() {
  const schedule = generateRepaymentSchedule({
    principal: 1200000,
    months: 6,
    monthlyRate: 0.02,
    interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  });

  assert.equal(schedule.length, 6);
  assert.deepEqual(
    schedule.map((item) => item.interest),
    [24000, 20000, 16000, 12000, 8000, 4000]
  );
  assert.deepEqual(
    schedule.map((item) => item.payment),
    [224000, 220000, 216000, 212000, 208000, 204000]
  );
  assert.equal(sumBy(schedule, 'principal'), 1200000);
  assert.equal(sumBy(schedule, 'interest'), 84000);
  assert.equal(schedule[schedule.length - 1].balance, 0);
}

function testReducingEqualRemainderDistribution() {
  const schedule = generateRepaymentSchedule({
    principal: 1001,
    months: 3,
    monthlyRate: 0,
    interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  });

  assert.deepEqual(
    schedule.map((item) => item.principal),
    [334, 334, 333]
  );
  assert.equal(sumBy(schedule, 'principal'), 1001);
  assert.equal(schedule[schedule.length - 1].balance, 0);
}

function testCustomFlatSchedule() {
  const schedule = generateRepaymentSchedule({
    principal: 1000,
    months: 3,
    monthlyRate: 0.1,
    customPayments: [500, 400, 400],
    interestCalculationMode: INTEREST_CALCULATION_MODES.FLAT
  });

  assert.equal(schedule.length, 3);
  assert.deepEqual(
    schedule.map((item) => item.interest),
    [100, 100, 100]
  );
  assert.equal(schedule[schedule.length - 1].balance, 0);
}

function testCustomReducingSchedule() {
  const schedule = generateRepaymentSchedule({
    principal: 1000,
    months: 3,
    monthlyRate: 0.1,
    customPayments: [500, 350, 341],
    interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  });

  assert.equal(schedule.length, 3);
  assert.deepEqual(
    schedule.map((item) => item.interest),
    [100, 60, 31]
  );
  assert.equal(sumBy(schedule, 'principal'), 1000);
  assert.equal(schedule[schedule.length - 1].balance, 0);
}

function testCustomPaymentBelowInterestFails() {
  assert.throws(() =>
    generateRepaymentSchedule({
      principal: 1000,
      months: 2,
      monthlyRate: 0.1,
      customPayments: [50, 2000],
      interestCalculationMode: INTEREST_CALCULATION_MODES.FLAT
    })
  );
}

function testCustomPlanMustClearPrincipal() {
  assert.throws(() =>
    generateRepaymentSchedule({
      principal: 1000,
      months: 2,
      monthlyRate: 0.1,
      customPayments: [200, 200],
      interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
    })
  );
}

function testScheduledInterestFallbackFlat() {
  const scheduledInterest = calculateScheduledInterest({
    loanAmount: 500000,
    planItem: { month: 2, principal: 100000, balance: 400000 },
    currentBalance: 400000,
    monthlyRate: 0.02,
    interestCalculationMode: INTEREST_CALCULATION_MODES.FLAT
  });

  assert.equal(scheduledInterest, 10000);
}

function testScheduledInterestFallbackReducing() {
  const scheduledInterest = calculateScheduledInterest({
    loanAmount: 500000,
    planItem: { month: 2, principal: 100000, balance: 400000 },
    currentBalance: 400000,
    monthlyRate: 0.02,
    interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  });

  assert.equal(scheduledInterest, 10000);
}

function testEarlyPayoffFlatVsReducing() {
  const flat = calculateEarlyPayoffInterest({
    loanAmount: 1000,
    currentBalance: 600,
    monthlyRate: 0.02,
    earlyPenaltyRate: 0.01,
    interestCalculationMode: INTEREST_CALCULATION_MODES.FLAT
  });
  const reducing = calculateEarlyPayoffInterest({
    loanAmount: 1000,
    currentBalance: 600,
    monthlyRate: 0.02,
    earlyPenaltyRate: 0.01,
    interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  });

  assert.equal(flat.interestBase, 1000);
  assert.equal(flat.totalInterest, 30);
  assert.equal(reducing.interestBase, 600);
  assert.equal(reducing.totalInterest, 18);
}

function testEarlyPayoffRoundingEdgeCase() {
  const reducing = calculateEarlyPayoffInterest({
    loanAmount: 1000,
    currentBalance: 333,
    monthlyRate: 0.015,
    earlyPenaltyRate: 0.01,
    interestCalculationMode: INTEREST_CALCULATION_MODES.REDUCING_BALANCE
  });

  assert.equal(reducing.regularInterest, 5);
  assert.equal(reducing.penaltyInterest, 4);
  assert.equal(reducing.totalInterest, 9);
}

function run() {
  testNormalizeMode();
  testFlatEqualSchedule();
  testReducingEqualSchedule();
  testReducingEqualRemainderDistribution();
  testCustomFlatSchedule();
  testCustomReducingSchedule();
  testCustomPaymentBelowInterestFails();
  testCustomPlanMustClearPrincipal();
  testScheduledInterestFallbackFlat();
  testScheduledInterestFallbackReducing();
  testEarlyPayoffFlatVsReducing();
  testEarlyPayoffRoundingEdgeCase();
  // eslint-disable-next-line no-console
  console.log('Interest calculation tests passed (12/12).');
}

run();
