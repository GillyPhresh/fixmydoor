CREATE TABLE "QuotationDeposit" (
  "quoteId" TEXT NOT NULL PRIMARY KEY,
  "amountCents" INTEGER NOT NULL CHECK ("amountCents" > 0),
  "basisPoints" INTEGER CHECK ("basisPoints" BETWEEN 1 AND 10000),
  "dueOn" TEXT NOT NULL,
  "agreedTermsReference" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotationDeposit_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quotation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
