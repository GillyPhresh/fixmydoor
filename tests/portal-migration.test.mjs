import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();

test("multi-user migration preserves existing commercial and booking records", () => {
  const db = new DatabaseSync(":memory:");
  const apply = name => db.exec(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
  try {
    for (const migration of migrations.filter(name => name < "20261123030000_multi_user_portals")) apply(migration);
    db.exec(`
      INSERT INTO Customer (id,name,category,email,phone,preferredContactMethod,notes) VALUES ('customer-existing','Existing Business','Business','office@example.invalid','5145550100','Email','staff-only customer notes');
      INSERT INTO Booking (id,name,phone,email,address,repairType,status,customerToken,customerId,updatedAt) VALUES ('booking-existing','Existing Customer','5145550100','office@example.invalid','10 Example Street','Door repair','CONFIRMED','permanent-tracking-token','customer-existing',CURRENT_TIMESTAMP);
      INSERT INTO Quotation (id,customerId,description,notes,status,expiresOn,taxLabel,taxCents,subtotalCents,totalCents) VALUES ('quote-existing','customer-existing','Existing quote','private margin','SENT','2099-01-01','',0,1000,1000);
    `);
    apply("20261123030000_multi_user_portals");
    assert.deepEqual({ ...db.prepare("SELECT id,customerToken,customerId,requestedByPortalAccountId FROM Booking WHERE id='booking-existing'").get() }, {
      id: "booking-existing", customerToken: "permanent-tracking-token", customerId: "customer-existing", requestedByPortalAccountId: null,
    });
    assert.equal(db.prepare("SELECT notes FROM Customer WHERE id='customer-existing'").get().notes, "staff-only customer notes");
    assert.equal(db.prepare("SELECT notes FROM Quotation WHERE id='quote-existing'").get().notes, "private margin");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    const jobColumns = new Set(db.prepare("PRAGMA table_info(Job)").all().map(column => column.name));
    assert(jobColumns.has("technicianResponse"));
    assert(jobColumns.has("technicianResponseAt"));
    assert.equal(db.prepare("SELECT technicianResponse FROM Job").all().length, 0);
  } finally {
    db.close();
  }
});
