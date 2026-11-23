import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
test("commercial migration preserves legacy booking, tracking, attachment and staff rows", () => {
  const db = new DatabaseSync(":memory:");
  const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
  function apply(m) {
    db.exec(readFileSync("prisma/migrations/" + m + "/migration.sql", "utf8"));
  }
  try {
    for (const m of migrations.filter(m => m < "20261123000000_commercial"))
      apply(m);
    db.exec(`INSERT INTO Booking (id,name,phone,email,address,repairType,customerToken,updatedAt) VALUES ('old','Test','111','legacy@example.invalid','Test','Repair','permanent-link',CURRENT_TIMESTAMP);
      INSERT INTO Attachment(id,bookingId,image) VALUES ('photo','old',x'1234');
      INSERT INTO Admin(id,username,password) VALUES ('staff','fixture','unused');`);
    for (const m of migrations.filter(m => m >= "20261123000000_commercial"))
      apply(m);
    assert.deepEqual(
      {
        ...db
          .prepare(
            "SELECT id,customerToken,visitMode,customerId,propertyId FROM Booking"
          )
          .get(),
      },
      {
        id: "old",
        customerToken: "permanent-link",
        visitMode: "ONSITE",
        customerId: null,
        propertyId: null,
      }
    );
    assert.equal(
      db
        .prepare(
          "SELECT hex(image) AS bytes FROM Attachment WHERE bookingId='old'"
        )
        .get().bytes,
      "1234"
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM Admin").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM Customer").get().n, 0);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
