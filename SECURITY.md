# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue.

Instead, report it privately via [GitHub Security Advisories](https://github.com/Jabito/arkynate-bottlenecker/security/advisories/new) or email the maintainer directly.

We will acknowledge receipt within 48 hours and aim to provide a fix or mitigation plan within 7 days.

## Scope

Bottlenecker is a static single-page app with no backend of its own. Diagrams stay in the browser (localStorage, share links in the URL fragment). The only third parties are an anonymous event counter (Supabase REST, insert-only event names) and Google AdSense. Security issues we care about include:

- Cross-site scripting (XSS) or CSS injection via crafted diagram data (imported files or share links)
- Abuse of the public Supabase endpoint (e.g. writing arbitrary rows or reading more than the counters)
- Dependency vulnerabilities
- Data exfiltration through third-party scripts
