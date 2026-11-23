/** Calculate an agreed quotation deposit in CAD cents without floating point rounding. */
export function calculateDepositCents(
  quotationTotalCents: number,
  terms: { type: "FIXED"; cents: number } | { type: "PERCENTAGE"; basisPoints: number },
): number {
  if (!Number.isSafeInteger(quotationTotalCents) || quotationTotalCents < 1) {
    throw new RangeError("Quotation total must be a positive integer in cents.");
  }

  let cents: number;
  if (terms.type === "FIXED") {
    cents = terms.cents;
  } else {
    const { basisPoints } = terms;
    if (!Number.isSafeInteger(basisPoints) || basisPoints < 1 || basisPoints > 10_000) {
      throw new RangeError("Deposit percentage must be between 0.01% and 100%.");
    }
    cents = Number((BigInt(quotationTotalCents) * BigInt(basisPoints) + 5_000n) / 10_000n);
  }
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > quotationTotalCents) {
    throw new RangeError("Deposit must be at least one cent and cannot exceed the quotation total.");
  }
  return cents;
}
