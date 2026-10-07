# Planha Site

Planha web application and edge/site runtime.

## Requirements

- Node.js 22.13 or newer
- npm

## Setup

```bash
npm ci
npm run dev
```

## Quality checks

```bash
npm run typecheck
npm run test:analysis
npm run test:local-staging-contract
npm run build
```

## Local Staging

The canonical pre-production workflow uses a production-like local backend and
local Worker emulation. See [LOCAL_STAGING.md](LOCAL_STAGING.md) for the exact
startup procedure. Local and CI execution never silently falls back to an
online Staging service.

```text
Developer
    ↓
Local Development
    ↓
Production-like Local Staging
    ↓
Backend PR + Site PR
    ↓
GitHub CI / SWCIS
    ↓
Owner Merge Approval
    ↓
Production
```

Online Staging is on-demand only for infrastructure behavior that cannot be
reproduced reliably locally, such as edge/TLS, external callbacks, Railway
networking, or major migration rehearsals.

## Runtime configuration

`PLANHA_ENGINE_URL` must explicitly select the correct backend for each
environment. `PANEL_BRIDGE_TOKEN` is a secret runtime binding and must never be
committed. If the engine binding is absent, the bridge fails closed locally
instead of contacting Online Staging.

No Production deployment or Production configuration is changed by this
repository setup.
