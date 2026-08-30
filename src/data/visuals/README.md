# Publication-safe visual data

`demo.ts` is the only data source used by the current local theater. It is
synthetic, normalized, abstract, and visibly labeled illustrative.

A later measured article may use the same `sbhc.daa.visual.v1` interface only
after a build-time adapter produces a curated public export with:

- `kind: sanitized_public_export`;
- the exact SHA-256 of its public publication manifest;
- one or more bounded public schema identities;
- normalized abstract coordinates and the allowlisted event vocabulary;
- `rawProviderResponsesIncluded: false`.

The adapter must fail closed. It must never read experiment custody, raw locks,
provider responses, operational ledgers, credentials, targets, addresses,
paths, payloads, destinations, or live feeds. The browser performs no fetch.
