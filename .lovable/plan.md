## Change your email sender domain

This is a configuration change in Cloud, not a code change — no files need to be edited. Your current sender is `notify.stemtutor.com` (still pending DNS verification).

### Steps

1. Open **Cloud → Emails → Manage Domains**.
2. Remove `notify.stemtutor.com` (three-dot menu → Remove).
3. Click **Add domain** and enter the new subdomain you want to send from (for example `mail.yournewdomain.com`). Use a subdomain you own — Lovable does not offer a shared sender.
4. Lovable will show a TXT record and two NS records specific to the new domain. Add them at your DNS provider for the root domain.
5. Wait for verification (usually minutes, up to 72h). Status is visible in **Cloud → Emails**.

### What happens to your app

- No code changes required. The send helper (`src/lib/email-templates/send-email.ts`) reads the configured sender domain automatically.
- While the new domain is verifying, lesson confirmation/reminder/cancellation emails will not deliver (they'll fail silently with `domain_not_verified`, and booking still succeeds).
- Auth emails (signup, password reset) keep working via the default Lovable fallback during the transition.
- Once verified, all lesson emails resume delivery to parent, student (if set), and tutor.

### Notes

- If you don't yet own the new root domain, buy one first via **Project Settings → Project → Domains → Buy new domain**, or any external registrar.
- If your DNS provider can't create NS records (e.g. Shopify-managed DNS), either transfer the domain into Lovable or move DNS hosting to a provider that supports NS records (e.g. Cloudflare free plan).

Want me to walk through this live once you've picked the new subdomain?