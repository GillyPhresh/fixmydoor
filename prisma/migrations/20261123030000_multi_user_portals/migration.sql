-- Additive multi-user portal foundation. Existing commercial records and IDs stay intact.
ALTER TABLE "Job" ADD COLUMN "technicianResponse" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Job" ADD COLUMN "technicianResponseAt" DATETIME;

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "externalId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Organization_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Organization_customerId_key" ON "Organization"("customerId");
CREATE UNIQUE INDEX "Organization_externalId_key" ON "Organization"("externalId");

CREATE TABLE "PortalAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "customerId" TEXT,
  "technicianId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "lastLoginAt" DATETIME,
  CONSTRAINT "PortalAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PortalAccount_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PortalAccount_email_key" ON "PortalAccount"("email");
CREATE UNIQUE INDEX "PortalAccount_technicianId_key" ON "PortalAccount"("technicianId");
CREATE INDEX "PortalAccount_customerId_status_idx" ON "PortalAccount"("customerId", "status");
CREATE INDEX "PortalAccount_kind_status_idx" ON "PortalAccount"("kind", "status");

ALTER TABLE "Booking" ADD COLUMN "requestedByPortalAccountId" TEXT REFERENCES "PortalAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Booking_requestedByPortalAccountId_idx" ON "Booking"("requestedByPortalAccountId");

CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "invitedBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  CONSTRAINT "OrganizationMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PortalAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrganizationMembership_accountId_organizationId_key" ON "OrganizationMembership"("accountId", "organizationId");
CREATE INDEX "OrganizationMembership_organizationId_status_role_idx" ON "OrganizationMembership"("organizationId", "status", "role");

CREATE TABLE "PortalInvitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "customerId" TEXT,
  "technicianId" TEXT,
  "organizationId" TEXT,
  "organizationRole" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "acceptedAt" DATETIME,
  "revokedAt" DATETIME,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalInvitation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PortalInvitation_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PortalInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PortalInvitation_tokenHash_key" ON "PortalInvitation"("tokenHash");
CREATE INDEX "PortalInvitation_email_expiresAt_idx" ON "PortalInvitation"("email", "expiresAt");
CREATE INDEX "PortalInvitation_customerId_acceptedAt_idx" ON "PortalInvitation"("customerId", "acceptedAt");
CREATE INDEX "PortalInvitation_technicianId_acceptedAt_idx" ON "PortalInvitation"("technicianId", "acceptedAt");
CREATE INDEX "PortalInvitation_organizationId_acceptedAt_idx" ON "PortalInvitation"("organizationId", "acceptedAt");

CREATE TABLE "CommunicationConsent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationConsent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CommunicationConsent_customerId_purpose_channel_capturedAt_idx" ON "CommunicationConsent"("customerId", "purpose", "channel", "capturedAt");

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_actorType_actorId_createdAt_idx" ON "AuditEvent"("actorType", "actorId", "createdAt");

CREATE TABLE "AIInteraction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "purpose" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "output" TEXT NOT NULL,
  "reviewedAt" DATETIME,
  "reviewedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AIInteraction_entityType_entityId_createdAt_idx" ON "AIInteraction"("entityType", "entityId", "createdAt");

CREATE TABLE "TechnicianMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "technicianId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INACTIVE',
  "billingPeriod" TEXT NOT NULL DEFAULT 'NONE',
  "startsOn" TEXT,
  "renewsOn" TEXT,
  "includedBenefits" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TechnicianMembership_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TechnicianMembership_technicianId_key" ON "TechnicianMembership"("technicianId");

CREATE TABLE "TechnicianMembershipEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "membershipId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "details" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicianMembershipEvent_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TechnicianMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TechnicianMembershipEvent_membershipId_createdAt_idx" ON "TechnicianMembershipEvent"("membershipId", "createdAt");
