# Platform direction and architecture

FixMyDoor operates from Montréal. Canadian expansion, remote consultations, providers, commerce and AI are planned capabilities, not statements of current service availability. Verify regulated trade eligibility, insurance and French-language requirements before launch.

Keep React/Vite, Express, Prisma/SQLite and Railway as a modular monolith. Do not switch databases/frameworks until concurrency, recovery or deployment evidence justifies it.

## Domain boundaries

Identity owns staff authentication, role grants and organization membership. Customers own contact identity and contact-level consent. Organizations contain authorized members and properties. Properties have service requests, which preserve existing Booking IDs and tracking links. Separate Job execution and Appointment scheduling from intake. ProviderProfile links a Technician to skills, verified credentials, insurance, ServiceRegions and time-bounded ServiceEligibility. Assignment records acceptance and completion evidence. Geography is data; never infer national coverage.

Quotes have versioned QuoteLines and approval state; Invoice references an accepted quote/job. Payments and PaymentAttempts are future provider-backed ledgers with idempotency, webhook verification and refunds. Contract and Subscription represent recurring commitments independently of payment status. Conversation/Message/Notification separate transactional delivery from ConsentRecord-governed marketing. AuditEvent records accountable actions without copying secrets. AIInteraction stores purpose, model version, redacted input references, output, human approval and execution audit.

All staff/customer/provider/property access must be checked server-side by relationship and role. A tracking bearer link grants only the existing public allowlist; it is never account or attachment authorization. Keep attachments private; explicit publication creates a separate public asset.

## Commercial sequence

1. Release security foundation and recovery evidence.
2. Add customer/contact/property relationships around existing bookings, deduplication review and audit events. Preserve every booking ID and token. Purpose: repeat business and property service history. Depends on permissions, contact consent and additive backfill tests.
3. Extract ServiceRequest/Job/Appointment with assignment and scheduling conflicts. Purpose: delegate operational work.
4. Versioned quotations/invoices, then remote consultation scheduling and test-mode payments; launch only after owner chooses provider/tax/refund policy.
5. Technician applications, credential review, regional eligibility and dispatch; then B2B organizations and recurring contracts.
6. AI drafts/classification/summary and matching recommendations, with approval before prices, regulated advice, outreach or dispatch. Durable outbox jobs require idempotency, retry limits, delivery state and audit. No autonomous financial or customer decisions.
7. Commerce and regional expansion after verified service/provider coverage.

Do not create all target tables now. First migration adds optional customer/property references beside Booking; backfill on a snapshot, validate counts and references, then switch reads incrementally. Evaluate PostgreSQL only when measured concurrent writes or multi-replica requirements exceed SQLite.
