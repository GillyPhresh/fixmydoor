import { createHash, createHmac } from "node:crypto";
import { realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const bucket = "fixmydoor-staging-backups";
const prefix = "sqlite-media/v1/staging/";
const actionsByRole = { WRITE: ["PutObject"], READ: ["HeadObject", "GetObject"] };
const toBase64Url = value => Buffer.from(JSON.stringify(value)).toString("base64url");

export function stagingSessions(env, issuedAt = Math.floor(Date.now() / 1000)) {
  const endpoint = env.FMD_S3_ENDPOINT;
  const match = /^https:\/\/([a-f0-9]{32})\.us\.r2\.cloudflarestorage\.com\/?$/.exec(endpoint ?? "");
  if (!match || env.FMD_S3_BUCKET !== bucket || env.FMD_ALLOW_R2_STAGING_TEST !== "approved" || env.FMD_ALLOW_PRODUCTION_TRANSFER) {
    throw new Error("Expected approved staging bucket and US R2 endpoint");
  }
  if (env.FMD_R2_PARENT_WRITE_ID === env.FMD_R2_PARENT_READ_ID) throw new Error("Distinct staging parent tokens required");

  const values = { FMD_S3_ENDPOINT: new URL(endpoint).origin, FMD_S3_BUCKET: bucket, FMD_ALLOW_R2_STAGING_TEST: "approved" };
  for (const [role, actions] of Object.entries(actionsByRole)) {
    const accessKeyId = env[`FMD_R2_PARENT_${role}_ID`];
    const secret = env[`FMD_R2_PARENT_${role}_SECRET`];
    if (!/^[a-f0-9]{32}$/.test(accessKeyId ?? "") || !/^[a-f0-9]{64}$/.test(secret ?? "")) throw new Error("Invalid parent credential format");

    const claims = { bucket, actions, paths: { prefixPaths: [prefix], objectPaths: [] }, sub: match[1],
      iss: accessKeyId, aud: new URL(endpoint).host, iat: issuedAt, exp: issuedAt + 900 };
    const unsigned = `${toBase64Url({ alg: "HS256", typ: "JWT" })}.${toBase64Url(claims)}`;
    const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");
    const jwt = `${unsigned}.${signature}`;
    values[`FMD_S3_${role}_ID`] = accessKeyId;
    values[`FMD_S3_${role}_SECRET`] = createHash("sha256").update(jwt).digest("hex");
    values[`FMD_S3_${role}_TOKEN`] = Buffer.from(`jwt/${jwt}`).toString("base64");
  }
  return values;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, ...other] = process.argv.slice(2);
    if (!file || other.length) throw new Error("Expected a new output file outside the project");
    const parent = await realpath(path.dirname(path.resolve(file)));
    const target = path.join(parent, path.basename(file));
    const relative = path.relative(await realpath(process.cwd()), target);
    if (!path.isAbsolute(relative) && !relative.startsWith(`..${path.sep}`)) throw new Error("Output is inside the project");
    const sessions = Object.entries(stagingSessions(process.env)).map(([name, value]) => `${name}=${value}`).join("\n") + "\n";
    await writeFile(target, sessions, { flag: "wx", mode: 0o600 });
    console.log("R2_STAGING_SESSIONS_READY expiresInSeconds=900");
  } catch {
    console.error("R2_STAGING_SESSIONS_FAILED");
    process.exitCode = 1;
  }
}
