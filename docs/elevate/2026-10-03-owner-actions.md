# Bottlenecker — owner actions from the 2026-10-03 elevate pass

These register items can't be fixed in this repo's code: they live in Supabase, AWS, Cloudflare or the AdSense console. The code side of each was handled in the apply wave where possible (noted per item). Times are PHT (UTC+8).

## 1. Supabase: lock down `playground_stats` (#32, #33)

Today the shipped publishable key needs anon INSERT and SELECT on the table, so anyone can inflate the public counters or insert junk event types. The client now sends only allow-listed event names, debounces Analyze, skips non-production builds and caches counts. The server side still has to enforce it.

Run in the Supabase SQL editor (check first: `select * from pg_policies where tablename = 'playground_stats';`):

```sql
-- 1. Counters table maintained server-side
create table if not exists public.playground_counters (
  event_type text primary key,
  total      bigint not null default 0
);
insert into public.playground_counters (event_type, total)
select event_type, count(*) from public.playground_stats group by event_type
on conflict (event_type) do update set total = excluded.total;

-- 2. Allow-listed bump RPC (anon can call this, nothing else)
create or replace function public.bump(event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if event not in ('page_view','analyze_click','template_used','export_json','export_png','export_jpg') then
    return;
  end if;
  insert into playground_stats (event_type) values (event);
  insert into playground_counters (event_type, total) values (event, 1)
  on conflict (event_type) do update set total = playground_counters.total + 1;
end $$;
grant execute on function public.bump(text) to anon;

-- 3. Anon reads counters only; no direct table access
alter table public.playground_stats   enable row level security;
alter table public.playground_counters enable row level security;
revoke insert, select on public.playground_stats from anon;
create policy "anon reads counters" on public.playground_counters for select to anon using (true);
```

After that, the client should switch to `POST /rest/v1/rpc/bump` and `GET /rest/v1/playground_counters?event_type=eq.<x>`. That is a small change in `src/lib/analytics.ts`, and it must be made **in the same deploy** as the SQL above, or the counters stop working. Per-IP rate limiting needs an Edge Function or Cloudflare in front; that's optional.

Open question from the review: the live counters didn't render on 2026-10-03. Check that the response exposes `Content-Range` (CORS `Access-Control-Expose-Headers`); the counters-table approach above avoids needing it.

## 2. CloudFront: security headers (#39)

CloudFront console → Policies → Response headers → create a custom policy (based on `Managed-SecurityHeadersPolicy`):
- HSTS `max-age=31536000; includeSubDomains`, X-Content-Type-Options `nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, X-Frame-Options `DENY`.
- Content-Security-Policy (start with `Content-Security-Policy-Report-Only` for a week):
  `default-src 'self'; script-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com 'unsafe-inline'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://wuequrujsgfkhpcctkmj.supabase.co https://*.google.com https://*.googlesyndication.com; frame-src https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com; frame-ancestors 'none'`
- Attach it to distribution `E26OMXWJ6166C0`, Behaviors → Default → Response headers policy.

## 3. CloudFront: real 404s instead of soft 404s (#38)

The app now renders a NotFound page with `noindex` on unknown routes, so search engines stop indexing them. To return a real HTTP 404, replace the 403/404 → `/index.html` (200) error mapping with a CloudFront Function on viewer-request:

```js
function handler(event) {
  var r = event.request, u = r.uri;
  var spa = ['/', '/components', '/lessons', '/playground', '/privacy'];
  if (spa.indexOf(u) !== -1 || spa.indexOf(u.replace(/\/$/, '')) !== -1) r.uri = '/index.html';
  return r;
}
```

Keep a 404 error response that serves `/index.html` with **status 404**, so the NotFound page still renders. When adding a route to `src/App.tsx`, add it to this list too.

## 4. GitHub Actions → AWS OIDC (#92)

Create an IAM role trusting `token.actions.githubusercontent.com` for `repo:Jabito/arkynate-bottlenecker:ref:refs/heads/main`. Allow only `s3:ListBucket`, `s3:PutObject`, `s3:DeleteObject` on `bottlenecker-app.arkynate.com` and `cloudfront:CreateInvalidation` on `E26OMXWJ6166C0`. Then replace the key env vars in `deploy.yml` with `aws-actions/configure-aws-credentials@v4` (`role-to-assume`, `aws-region: ap-southeast-1`) and `permissions: id-token: write`, and delete the `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` repo secrets.

## 5. AdSense privacy and consent (#29)

- AdSense → Privacy & messaging → create a **GDPR (European regulations)** message and publish it. That gives you Google's certified CMP with no code. Also consider the **US state regulations** message.
- Check whether the site is approved and ads are serving: every slot showed `data-ad-status` unfilled on 2026-10-03.
- Decide whether Auto ads may place anchor or vignette ads over the playground canvas. If not, exclude `/playground` in Auto ads → URL exclusions.
- The new `/privacy` page describes what is collected. Link it in the AdSense site settings.

## 6. S3 bucket access (owner question 12)

Check whether `bottlenecker-app.arkynate.com` is private behind CloudFront Origin Access Control. If the bucket allows public reads or website hosting, switch the origin to OAC and block public access.

## 7. Monitoring (lead observation L1)

The site was down from 2026-09-21 07:59:59 PHT until it was spotted by hand on 2026-10-01 (expired ACM certificate). In PingOps, add HTTPS + SSL-expiry monitors for `bottlenecker.arkynate.com`, `arkynate.com` and `archon.arkynate.com`, with alerts at 30 and 7 days before expiry.

## 8. Carried over from the 2026-10-02 DNS fix

- Delete the AWS **root** access key used for the fix (console → Security credentials → Access keys) and remove `[arkynate]` from `~/.aws/credentials`.
- `archon.arkynate.com` still has no DNS record (distribution `ESJYGJE1UZT6Y`, `dmpk3eeigzegi.cloudfront.net`).
- Check `arkynate-k8s/projects/arkynate-resto/values-prod.yaml` for a committed AWS key.
