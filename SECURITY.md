# Security Policy

## Reporting Security Issues

If you discover a security vulnerability, please do not open a public issue.

Please report it privately to the project maintainer.

Include the affected commit, deployment mode, reproduction steps and impact. The maintainer should
acknowledge a report within 3 working days and provide an initial severity assessment within 7.

## Supported Versions

Only the latest development version is currently supported.

## Deployment boundary

The default server binds only to `127.0.0.1`. This is the supported local-demo mode.

- `HOST=0.0.0.0` or any non-loopback host is rejected unless `GAME_API_TOKEN` is set.
- `ALLOWED_ORIGINS` is a comma-separated exact allowlist. Defaults are the local Vite origins.
- Remote HTTP clients send `Authorization: Bearer <GAME_API_TOKEN>`.
- WebSocket handshakes enforce the same Origin and Bearer-token policy.
- JSON bodies are limited to 64 KiB; API requests are rate-limited per source address.

This token gate is a minimal single-user boundary, not a multi-tenant account system. Public or
multi-user deployment additionally requires TLS at a trusted reverse proxy, per-user sessions,
authorization, CSRF review, game-instance isolation, durable audit logs and concurrency controls.

Never put `GAME_API_TOKEN` in source files, screenshots, URLs or client-side bundles.

## Data and logs

Agent databases, browser snapshots and debug logs are governed by
`docs/agent-data-retention-policy.md` and must not enter Git or release artifacts.
