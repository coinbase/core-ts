# Changelog

## [0.4.2] - 2026-JUL-23

### Added

- **Mutual TLS (mTLS) support.** `CoinbaseHttpClientRetryOptions` and `CoinbaseCallOptions` now accept:
  - `tls`: raw certificate material (`cert`, `key`, `ca`, `passphrase`, `pfx`, `rejectUnauthorized`)
  - `httpsAgent`: a pre-built Node.js `https.Agent` (takes precedence over `tls`)
- Exported `CoinbaseTlsOptions` and `CoinbaseTlsMaterial` types from the public API.

## [0.4.1] - 2026-JUL-16

### Fixed

- **HTTP transformers registered multiple times.** When a request passed `callOptions`, `CoinbaseHttpClient` re-registered request/response transformers on the per-call axios client, causing:
  - Per-call `transformRequest` / `transformResponse` handlers to run twice.
  - Global (constructor-level) transformers to run up to three times per call.
  - Per-call transformers to leak into `addedRequestTransformers` / `addedResponseTransformers` and execute on unrelated later requests, growing unbounded over time.

  `_setupHttpClient` now only builds the axios instance and retry behavior; transformer registration is handled separately so each transformer runs exactly once and per-call transformers are never persisted. `addTransformRequest` / `addTransformResponse` are now idempotent for the same handler reference.

### Added

- Jest test runner (`ts-jest`) with `test`, `test:watch`, and `test:coverage` scripts, plus regression tests covering transformer registration behavior.
