const assert = require('node:assert/strict');
const { allocateProRataByOutstanding } = require('../functions/loan-management/waterfall');

function allocationsById(result) {
  return result.allocations.reduce((acc, row) => {
    acc[row.requestId] = row;
    return acc;
  }, {});
}

function testSingleGuarantor() {
  const result = allocateProRataByOutstanding(
    [{ $id: 'g1', securedOutstanding: 400000 }],
    100000
  );
  const byId = allocationsById(result);

  assert.equal(result.totalOutstanding, 400000);
  assert.equal(result.allocatable, 100000);
  assert.equal(byId.g1.share, 100000);
  assert.equal(byId.g1.nextOutstanding, 300000);
}

function testEqualSplitGuarantors() {
  const result = allocateProRataByOutstanding(
    [
      { $id: 'g1', securedOutstanding: 400000 },
      { $id: 'g2', securedOutstanding: 400000 }
    ],
    100000
  );
  const byId = allocationsById(result);

  assert.equal(result.totalOutstanding, 800000);
  assert.equal(result.allocatable, 100000);
  assert.equal(byId.g1.share, 50000);
  assert.equal(byId.g2.share, 50000);
  assert.equal(byId.g1.nextOutstanding, 350000);
  assert.equal(byId.g2.nextOutstanding, 350000);
}

function testUnequalSplitGuarantors() {
  const result = allocateProRataByOutstanding(
    [
      { $id: 'g1', securedOutstanding: 600000 },
      { $id: 'g2', securedOutstanding: 200000 }
    ],
    160000
  );
  const byId = allocationsById(result);

  assert.equal(result.totalOutstanding, 800000);
  assert.equal(result.allocatable, 160000);
  assert.equal(byId.g1.share, 120000);
  assert.equal(byId.g2.share, 40000);
  assert.equal(byId.g1.nextOutstanding, 480000);
  assert.equal(byId.g2.nextOutstanding, 160000);
}

function testPartialSettlement() {
  const result = allocateProRataByOutstanding(
    [
      { $id: 'g1', securedOutstanding: 300000 },
      { $id: 'g2', securedOutstanding: 100000 }
    ],
    80000
  );
  const byId = allocationsById(result);

  assert.equal(result.totalOutstanding, 400000);
  assert.equal(result.allocatable, 80000);
  assert.equal(byId.g1.share, 60000);
  assert.equal(byId.g2.share, 20000);
  assert.equal(byId.g1.nextOutstanding, 240000);
  assert.equal(byId.g2.nextOutstanding, 80000);
}

function run() {
  testSingleGuarantor();
  testEqualSplitGuarantors();
  testUnequalSplitGuarantors();
  testPartialSettlement();
  // eslint-disable-next-line no-console
  console.log('Waterfall repayment tests passed (4/4).');
}

run();
