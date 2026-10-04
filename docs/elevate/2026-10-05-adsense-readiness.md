# AdSense readiness audit — arkynate.com + bottlenecker.arkynate.com — 2026-10-05 (PHT)

Context: the site was resubmitted for AdSense review on 2026-10-03. This audit looks for anything that could still block approval while we wait for the next crawl. Every number below comes from live requests made on 2026-10-05.

## Passing

| Check | arkynate.com | bottlenecker.arkynate.com |
|---|---|---|
| HTTPS, valid certificate | to 2027-02-22 07:59:59 PHT | to 2027-04-17 07:59:59 PHT |
| http → https redirect | 301 | 301 |
| `ads.txt` (text/plain, correct publisher, `f08c47fec0942fa0`) | yes, plus `subdomain=` line | yes |
| Verification meta tag `google-adsense-account` | on every prerendered page | in index.html |
| robots.txt blocks no Google crawler | yes | yes |
| Every sitemap URL returns 200 | 24/24 | 5/5 |
| Privacy policy page | `/privacy` (784 words) | `/privacy` (421 words) |
| Contact / about | `/contact`, `/about` | **missing** (see B3) |
| Ad slots send ad requests | no ads on this site | 7 fixed-size slots, all requested (fixed in 2.3.1) |

## Findings

| # | Severity | Site | Finding | Evidence | Fix |
|---|---|---|---|---|---|
| B1 | **likely blocker** | bottlenecker | Every route serves an empty SPA shell: **8 words** of raw HTML. Content appears only after JavaScript runs (Lessons 1,681 words, Components 1,069, Home 310, Privacy 421). Empty or near-empty HTML is a common cause of "Low value content" rejections for SPAs. | `curl -A Mediapartners-Google` word count vs headless-Chrome rendered DOM | Prerender `/`, `/lessons`, `/components`, `/privacy` to static HTML at build time, as arkynate.com already does (`arkynate-labs-web/scripts/prerender.mjs`). Effort M. |
| B2 | **risk** | bottlenecker | `/playground` renders **39 words** of text around 3 ad slots (palette, config panel, under the canvas). Google's policy on "ads on screens without publisher content" is the usual reason tool pages get flagged. | rendered DOM word count | Keep ads on the content pages only (Home, Lessons, Components) until approval; bring playground ads back afterwards. Nothing fills today, so this costs no revenue now. Effort S. |
| B3 | risk | bottlenecker | No contact, about or publisher identity link anywhere on the site. Reviewers look for who runs it. | grep of Home, Navbar, Privacy: no contact/about link | Footer and navbar menu: "About Arkynate Labs" → `https://arkynate.com/about`, "Contact" → `https://arkynate.com/contact`. Effort S. |
| B4 | risk | bottlenecker | The privacy page lacks the opt-out links AdSense requires: Google **Ads Settings** (`https://adssettings.google.com`) and third-party vendor opt-out (`https://www.aboutads.info/choices`). The partner-sites link is present. | grep of `src/pages/PrivacyPage.tsx` | Add the standard AdSense disclosure paragraph with both links. Effort S. |
| B5 | policy hygiene | bottlenecker | The palette ad sits right under the draggable component list and the config-panel ad under form inputs. Ads beside interactive controls invite accidental clicks, and nothing labels them. | `ComponentPalette.tsx:124`, `ConfigPanel.tsx:383` | Add an "Advertisement" label and spacing above each slot (allowed wording). Covered by B2 while playground ads are off. Effort S. |
| B6 | minor | arkynate.com | `http://www.arkynate.com` returns **403** (only `https://www` redirects). Proxied in Cloudflare with a redirect rule that matches HTTPS only. | `curl http://www.arkynate.com/` → 403 | In Cloudflare, either SSL/TLS → Edge Certificates → turn on **Always Use HTTPS**, or extend the www → apex redirect rule to http. The DNS-only API token can't change rules, so this is a dashboard action. |
| B7 | minor | bottlenecker | Unknown paths return HTTP 200 with a client-side "Page not found" (`noindex`). | owner-actions §3 | CloudFront 404 function (owner-actions §3). Not an approval blocker. |

## Not an issue

- arkynate.com loads no ad script, so its "no tracking" privacy statement stays true. The verification meta tag sets no cookies.
- Subdomain vs separate domain: AdSense approves the root domain (`arkynate.com`), and that covers `bottlenecker.arkynate.com`. No separate domain needed.
- The 2026-09-21 → 2026-10-01 certificate outage would have failed any review in that window. It is fixed, and ACM validation records now keep renewals automatic.

## Status after the fixes (2026-10-05 PHT)

- B1 done (prerender, 2.3.2): live raw HTML is now Home 305, Lessons 1,681, Components 1,069, Privacy 490 words, each with its own title and canonical.
- B2–B5 done (2.3.2): playground ads paused (`PLAYGROUND_ADS_ENABLED`), ads labelled with spacing, privacy opt-out links, About/Contact links.
- B6 done (owner, Cloudflare Always Use HTTPS): `http://www.arkynate.com` → `https://arkynate.com` (200).
- Found during verification (2.3.3): content pages scrolled inside their own container rather than the window, and slots were pushed while off-screen. Content pages now scroll the window, and slots are pushed only near the viewport. Verified in headless Chrome (visible): both Home slots are requested on scroll; Lessons and Components are requested at load.
- B7 open (owner-actions §3, CloudFront 404 function). Not a blocker.
- `arkynate.com/about` returns 404 for a direct load (client-only redirect to `/operator` in arkynate-labs-web). Unlinked; low priority.
