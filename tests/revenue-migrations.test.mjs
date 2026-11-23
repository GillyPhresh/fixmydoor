import assert from "node:assert/strict";
import test from "node:test";
import {DatabaseSync} from "node:sqlite";
import {readFileSync,readdirSync} from "node:fs";
const migrations=readdirSync("prisma/migrations",{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();
for(const cutoff of ["20261123000000_commercial","20261123010000_delivery"]){
 test("revenue migrations preserve populated "+cutoff,()=>{
 const db=new DatabaseSync(":memory:");
 const migrate=name=>db.exec(readFileSync("prisma/migrations/"+name+"/migration.sql","utf8"));
 try{
 migrations.filter(m=>m<=cutoff).forEach(migrate);
 db.exec("INSERT INTO Customer(id,name,category,email,phone,preferredContactMethod,notes) VALUES ('c','Fixture','Business','','555','Phone',''); INSERT INTO Quotation(id,customerId,description,notes,expiresOn,taxLabel,taxCents,subtotalCents,totalCents) VALUES('q','c','Scope','','2099-01-01','',0,510,510)");
 if(cutoff.endsWith("delivery"))db.exec("INSERT INTO Job(id,reference,quoteId,agreement,category,province,city,location,description,updatedAt) VALUES('j','FMD-fixture','q','{}','ASSEMBLY','QC','TEST','Test','Job',CURRENT_TIMESTAMP); INSERT INTO JobPhoto(id,jobId,kind,image) VALUES('photo','j','AFTER',x'010203')");
 migrations.filter(m=>m>cutoff).forEach(migrate);
 assert.equal(db.prepare("SELECT totalCents FROM Quotation WHERE id='q' AND customerId='c'").get().totalCents,510);
 if(cutoff.endsWith("delivery"))assert.equal(db.prepare("SELECT hex(image) AS h FROM JobPhoto WHERE jobId='j'").get().h,"010203");
 assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{db.close()}
 });
}
