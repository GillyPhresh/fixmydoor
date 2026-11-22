# Dependency review — 2026-11-22

`corepack pnpm audit --json` before remediation: critical 4, high 24, moderate 27, low 3. After removing unused Vitest/Manus/debug plugins and pinning tar 7.5.19: critical 0, high 14, moderate 12, low 2. `pnpm audit --prod --json`: all severities zero. Audit commands return a failure status when advisories remain; this is an unresolved release gate, not a passing audit.

Patched tar advisory: https://github.com/advisories/GHSA-23hp-3jrh-7fpw . The affected dependency was Tailwind Oxide's archive tooling. Pin is restricted to its existing major; no Prisma, Express or database-provider upgrade was performed.

Remaining development/build families include Vite file serving/editor/WebSocket paths, Rollup output paths, PostCSS/source-map handling, picomatch patterns, nanoid, Browserslist and Babel. No runtime payment/messaging integration is added. Runtime dependencies returning zero does not prove absence of vulnerabilities: the current Docker image still includes build tools. Before production, triage reachability and update the affected build tools within compatible major versions, or isolate a minimal runtime stage while retaining Prisma CLI for startup migrations. Re-run frozen container build, audits and all regressions. Do not run audit --fix or a blanket dependency upgrade.

Keep Vite loopback-only. Do not accept untrusted build sources, archives, CSS/source maps or arbitrary editor inputs. These restrictions are containment while remediation is pending; they are not substitutes for patching.
