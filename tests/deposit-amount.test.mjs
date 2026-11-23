import assert from "node:assert/strict";
import test from "node:test";
import { calculateDepositCents } from "../server/deposit-amount.ts";

test("fixed and percentage deposits use CAD cents with half-up rounding", () => {
  assert.equal(calculateDepositCents(12_345, { type: "FIXED", cents: 2_000 }), 2_000);
  assert.equal(calculateDepositCents(101, { type: "PERCENTAGE", basisPoints: 5000 }), 51);
  assert.equal(calculateDepositCents(Number.MAX_SAFE_INTEGER, { type: "PERCENTAGE", basisPoints: 10000 }), Number.MAX_SAFE_INTEGER);
});

test("deposit terms reject overpayments, fractional cents and invalid percentages", () => {
  for (const cents of [-1, 0, 1.5, 101]) {
    assert.throws(() => calculateDepositCents(100, { type: "FIXED", cents }), RangeError);
  }
  for (const basisPoints of [0, 1, 10001]) {
    assert.throws(() => calculateDepositCents(100, { type: "PERCENTAGE", basisPoints }), RangeError);
  }
});
