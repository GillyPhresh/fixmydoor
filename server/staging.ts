import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

export const isStagingMode = process.env.STAGING_MODE === "true";

export function assertStagingConfiguration() {
  if (!isStagingMode) return;

  const username = process.env.STAGING_BASIC_AUTH_USERNAME?.trim();
  const password = process.env.STAGING_BASIC_AUTH_PASSWORD;
  if (!username || username.length > 128 || !password || password.length < 24 || password.length > 256) {
    throw new Error("Staging mode requires STAGING_BASIC_AUTH_USERNAME and a 24–256 character STAGING_BASIC_AUTH_PASSWORD.");
  }
}

function constantTimeEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function hasValidStagingCredentials(header: string | undefined) {
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  const username = process.env.STAGING_BASIC_AUTH_USERNAME?.trim() || "";
  const password = process.env.STAGING_BASIC_AUTH_PASSWORD || "";
  return constantTimeEqual(decoded.slice(0, separator), username) && constantTimeEqual(decoded.slice(separator + 1), password);
}

export function stagingAccessMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isStagingMode) return next();

  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");

  // Railway needs a public health URL for deployment checks. It returns only
  // generic process/database health and remains explicitly noindex/no-store.
  if (req.path === "/api/health") return next();
  if (hasValidStagingCredentials(req.get("authorization"))) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="FixMyDoor Staging", charset="UTF-8"');
  return res.status(401).type("text/plain").send("Staging access requires authentication.");
}

export function stagingRobotsTxt() {
  return isStagingMode
    ? "User-agent: *\nDisallow: /\n"
    : null;
}

export function markHtmlNoIndex(html: string) {
  let result = html.replace(/\s*<meta name="google-site-verification" content="[^"]*"\s*\/>/i, "");
  const robots = /<meta name="robots" content="[^"]*"\s*\/>/i;
  result = robots.test(result)
    ? result.replace(robots, '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />')
    : result.replace("</head>", '    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />\n  </head>');
  return result;
}
