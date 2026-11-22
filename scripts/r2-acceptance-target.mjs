const acceptanceTargets = new Map([
  ["fixmydoor-staging-backups", { jurisdiction: "us", approval: "FMD_ALLOW_R2_STAGING_TEST" }],
  ["fixmydoor-production-backups-eu", { jurisdiction: "eu", approval: "FMD_ALLOW_R2_EU_SYNTHETIC_TEST" }],
]);

export function acceptanceTarget(bucket, endpoint) {
  const target = acceptanceTargets.get(bucket);
  const match = /^https:\/\/([a-f0-9]{32})\.(us|eu)\.r2\.cloudflarestorage\.com\/?$/.exec(endpoint ?? "");
  if (!target || target.jurisdiction !== match?.[2]) throw Object.assign(new Error("Invalid synthetic R2 target"), { code: "UNAPPROVED_BUCKET" });
  return { ...target, bucket, endpoint: new URL(endpoint).origin, account: match[1] };
}

export function approvedAcceptanceTarget(env) {
  if (env.FMD_ALLOW_PRODUCTION_TRANSFER || env.FMD_ALLOW_PRODUCTION_CAPTURE ||
      ["FMD_ALLOW_R2_STAGING_TEST", "FMD_ALLOW_R2_EU_SYNTHETIC_TEST"].filter(name => env[name] === "approved").length !== 1) {
    throw Object.assign(new Error("Synthetic R2 authorization required"), { code: "UNAPPROVED_STORAGE_STAGING_TEST" });
  }
  const target = acceptanceTarget(env.FMD_S3_BUCKET, env.FMD_S3_ENDPOINT);
  if (env[target.approval] !== "approved") throw Object.assign(new Error("Synthetic target approval mismatch"), { code: "UNAPPROVED_STORAGE_STAGING_TEST" });
  return target;
}
