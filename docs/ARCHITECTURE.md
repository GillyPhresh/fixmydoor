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

## Commercial service management (expansion branch)

The authenticated workspace at `/admin/commercial` shares the existing Express admin session. `Customer` owns contact preferences, private notes and one or more `Property` records. Business customers can be represented by an organization name. Staff search and confirm each booking association. The earlier contact-derived Booking.clientId continues to serve legacy workflows and has no authority over these relationships.

`Quotation` belongs to one customer and optionally their property and linked booking. Each `QuoteLine` has an ordered position, labour/material classification, positive whole quantity and integer CAD unit price in cents. The server recomputes totals. Staff enter the applicable tax label and amount. Draft revisions replace all items in one SQLite transaction. Updates require the current version. Staff record sending and the customer's response manually. Sent quotations cannot be edited. Expiry comparisons use UTC calendar dates. The print layout exposes quotation details and excludes staff notes.

`Booking.visitMode` distinguishes on-site work from remote requests. The remote option accepts a request without a street address. Availability, communication preference, private photos, appointment and staff outcome use the existing booking workflow. The public tracking serializer continues to return its explicit field list.

Apply `20261123000000_commercial` through Prisma migration deployment on the intended isolated database. It adds four tables, indexed foreign keys and a default visit mode, preserving existing rows in place. Historical customer and property associations start empty. A future production release needs a separate reviewed migration and deployment decision.

## Multi-user service portals (Expansion Phase 3)

`PortalAccount` is a separate, invitation-only identity attached to an existing individual `Customer`, approved `Technician`, or organization membership. Invitations are single-use, stored by token hash and expire after 48 hours. Portal logins use the existing Express session store with session rotation and rate limiting. A booking reference is not an account credential. `/portal`, `/portal/login`, `/portal/invite` and `/admin/portals` are direct Express client routes; portal pages carry `noindex` metadata and response headers.

Customer and business users read existing properties, bookings, quotations, invoices, jobs and agreements through relationship-scoped queries and explicit response projections. New requests continue to create `Booking` records and preserve the legacy booking/tracking workflow. An organization maps to one existing Business `Customer`; membership roles distinguish organization administration, property management, requesting and billing access. Requesters see only their own submissions, and billing-only members see financial documents without job/property details. Invoice access is view-only because online collection is not enabled.

Approved technicians see only assigned jobs that still pass the existing service-grant category, province and city checks. Assignment responses, start and completion use version checks and audit records. Work photos remain in the existing private database-backed photo flow. Technician membership is an administrative record only: no payment instrument, subscription, charge or renewal is activated.

The staff triage panel is a deterministic rule adapter. It stores a category suggestion and staff-review state without sending customer data to an AI provider or taking operational action. It is not a tested external AI model. External-model selection, privacy review, human approval policy, durable automation/outbox, remote consultation scheduling and payment onboarding remain future decisions.

The portal migration is additive and preserves current booking identifiers. The existing startup schema-compatibility routine remains responsible for legacy SQLite fields and tables absent from the historic Prisma migration chain, including `Booking.clientId`, `Booking.emailOptOut` and `SmsDraft`. Do not add non-idempotent duplicate `ALTER TABLE` statements for these inherited objects. Validate this path against disposable clean and legacy-shaped fixtures before changing migration handling.
