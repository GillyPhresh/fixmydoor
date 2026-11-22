import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";

// In-memory S3 protocol fixture for synthetic archives. Never use as storage.
export async function startFakeS3() {
  const objects = new Map();
  const calls = { put: 0, get: 0 };
  const faults = { putUnavailable: 0, putLostResponse: 0, getInterrupted: 0, corruptRead: false };
  const bucketName = "fixmydoor-recovery-staging";
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname);
      const key = pathname.slice(bucketName.length + 2);
      if (!pathname.startsWith("/" + bucketName + "/") || !req.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")) {
        res.writeHead(403).end();
        return;
      }
      if (url.searchParams.get("list-type") === "2") {
        const prefix = url.searchParams.get("prefix") ?? "";
        const start = Number(url.searchParams.get("continuation-token") ?? 0);
        const matching = [...objects].filter(([name]) => name.startsWith(prefix));
        // Small pages exercise the production paginator.
        const entries = matching.slice(start, start + 1).map(([name, data]) =>
          `<Contents><Key>${name}</Key><Size>${data.body.length}</Size></Contents>`).join("");
        const more = start + 1 < matching.length;
        res.setHeader("content-type", "application/xml");
        res.end(`<ListBucketResult><IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${start + 1}</NextContinuationToken>` : ""}${entries}</ListBucketResult>`);
        return;
      }
      if (req.method === "PUT") {
        calls.put++;
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 4_000_000) throw new Error("Synthetic fixture too large");
          chunks.push(chunk);
        }
        if (faults.putUnavailable > 0) {
          faults.putUnavailable--;
          res.writeHead(503).end("<Error><Code>SlowDown</Code></Error>");
        } else if (req.headers["if-none-match"] !== "*") {
          res.writeHead(400).end();
        } else if (objects.has(key)) {
          res.writeHead(412).end("<Error><Code>PreconditionFailed</Code></Error>");
        } else {
          const body = Buffer.concat(chunks);
          const metadata = req.headers["x-amz-meta-sha256"];
          if (metadata !== createHash("sha256").update(body).digest("hex")) {
            res.writeHead(400).end();
            return;
          }
          const etag = '"' + createHash("md5").update(body).digest("hex") + '"';
          objects.set(key, { body, metadata, etag });
          if (faults.putLostResponse > 0) {
            faults.putLostResponse--;
            req.socket.destroy();
          } else res.writeHead(200, { etag }).end();
        }
        return;
      }
      const object = objects.get(key);
      if (!object) {
        res.writeHead(404).end();
        return;
      }
      const { body, metadata, etag } = object;
      if (req.method === "GET" && req.headers["if-match"] !== etag) {
        res.writeHead(412).end();
        return;
      }
      res.writeHead(200, { etag, "Content-Length": body.length, "x-amz-meta-sha256": metadata });
      if (req.method === "HEAD") { res.end(); return; }
      calls.get++;
      if (faults.getInterrupted > 0) {
        faults.getInterrupted--;
        res.write(body.subarray(0, 32));
        setImmediate(() => res.destroy());
        return;
      }
      const reply = Buffer.from(body);
      if (faults.corruptRead) reply[0] ^= 1;
      res.end(reply);
    } catch {
      if (!res.headersSent) res.writeHead(500).end();
      else res.destroy();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { endpoint: `http://127.0.0.1:${server.address().port}`, bucket: bucketName, faults, calls, objects,
    close: () => new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())) };
}
