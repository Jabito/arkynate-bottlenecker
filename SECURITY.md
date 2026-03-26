# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue.

Instead, report it privately via [GitHub Security Advisories](https://github.com/Jabito/arkynate-bottlenecker/security/advisories/new) or email the maintainer directly.

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 7 days.

## Scope

Bottlenecker is a client-side-only application with no backend. Security issues we care about include:

- Cross-site scripting (XSS) via crafted diagram data
- Dependency vulnerabilities
- Data exfiltration through third-party scripts
