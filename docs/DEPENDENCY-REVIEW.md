# Dependency review — 2026-11-22

## Result

Before this update, the installed lockfile produced 0 critical, 14 high, 12 moderate and 2 low advisories. The full tree is installed in the current single-stage Docker image, so development/build packages were treated as image-relevant even though they are not request-time imports. No advisory was suppressed.

After compatible patch updates and explicit pinned overrides, `corepack pnpm audit --json` and `corepack pnpm audit --prod --json` both report zero findings at every severity. The lockfile is the audited source of truth; the Docker image installs the same frozen lockfile with pnpm 10.4.1. Runtime versions remain on their existing majors. Vite stayed on major 7, Rollup on 4, PostCSS on 8, Babel on 7, and tar on 7.

## Former high-severity findings

All affected paths were dev/build dependencies; these are reachable during local development, builds, or processing of build inputs, but not via the deployed Express request handlers. Since the single-stage image includes the full dependency tree, the fix was to update rather than dismiss them.

| Package | Before → locked now | Advisory | Dependency path / risk context |
|---|---|---|---|
| Rollup | 4.52.4 → 4.68.8 | [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) | `vite > rollup`; build-time output path traversal |
| picomatch | 4.0.3 → 4.0.7 | [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | Vite/fdir/tinyglobby; crafted glob ReDoS |
| Vite | 7.1.9 → 7.3.8 | [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r), [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | Direct dev dependency and peer of both Vite plugins; dev-server file access/editor handling |
| PostCSS | 8.5.6 → 8.5.33 | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | Vite/autoprefixer; CSS source-map path disclosure |
| nanoid | 3.3.11 → 3.3.20 | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | PostCSS; malformed size input could hang or overflow |
| tar | 7.5.19 → 7.5.23 | [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m) | Tailwind Oxide; crafted archive recursion/DoS |
| Browserslist | 4.26.3 → 4.29.6 | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | Babel/autoprefixer; malicious stats/memory exhaustion |
| source-map-js | 1.2.1 → 1.2.4 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | PostCSS/Tailwind; crafted source-map CPU exhaustion |

The former moderate and low advisories were also resolved by the same compatible updates, including Vite Windows `server.fs.deny` variants, `baseline-browser-mapping` (2.8.13 → 2.11.39), and `postcss-selector-parser` (6.0.10 → 6.1.5). Exact installed versions and advisory state are verified by the frozen lockfile and current full audit; re-run the audit before each release because advisories change.

## Reproduction

Use the repository-pinned package manager, not a machine-global pnpm 11:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm audit
corepack pnpm audit --prod
```

The project pins pnpm 10.4.1 and keeps pnpm overrides in `package.json#pnpm`; a global pnpm 11 currently warns that it ignores this older configuration. Docker uses Corepack and the pinned version. Any future package-manager upgrade must migrate this configuration and regenerate the lockfile intentionally.

Do not use blanket `audit --fix` or override advisories to silence them. Review current advisory ranges and test dependency compatibility for every update.
