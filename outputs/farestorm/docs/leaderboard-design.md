# Optional verified leaderboard

No online leaderboard backend ships with this local build. Local records are untrusted user data. The following contract describes a future service and must not be presented as active verification.

## Session issuance

`POST /v1/challenges/start` accepts a supported build/rules version and challenge ID. The server returns a random nonce, fixed seed, expiry, taxi/assist category, traffic policy and signed token. Bind that token to the challenge and rules. Do not place secrets or signing keys in the browser.

## Submission

`POST /v1/challenges/submit` accepts the token, capped compressed input frames, periodic state hashes and claimed result. Limit uncompressed body size and frame count before allocating a simulation. Reject duplicate nonces, expired sessions, unknown builds, malformed numeric fields and inconsistent elapsed time. Apply rate limits by session/account and coarse network limits without accepting raw score as evidence.

Pin the verifier to an exact physics/runtime build. Re-simulate input at 60 Hz with the issued seed, taxi tuning, traffic policy, pickups and scoring rules. Compare checkpoints with documented tolerances. Recompute result and compare fare order, score actions, reset penalties, shortcut discovery, pickup caps, boost resource use and session length. Reject impossible action frequency, future timestamps and altered mode options. Record verifier reason codes without storing unnecessary personal data.

## Categories

Separate verified daily challenge, casual local Arcade Shift and assist categories. Steering or traffic settings that change performance belong to a distinct category. Local imported ghosts cannot become verified entries by upload alone.

## Ghost distribution

Public ghost responses contain only a bounded list of timestamped transforms and a sanitized display name. Never ship executable code, HTML or raw user-provided URLs in a ghost. Limit names to a short normalized string, cap samples/duration, validate finite coordinates and rate-limit downloads. Metadata identifies rules/build and whether server verification succeeded.

## Failure UX

If offline, retain the completed local score and explain that verification is pending or unavailable. Explicitly distinguish an expired token, incompatible rules, rejected run and network error. A submission retry may reuse only its own unspent session token. Players can always restart local play.

This is a design artifact, not a claim that browser physics is perfectly deterministic or that local checksum records resist tampering.
