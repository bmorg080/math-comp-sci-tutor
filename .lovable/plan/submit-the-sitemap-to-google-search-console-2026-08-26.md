# Submit the sitemap to Google Search Console

Goal: get `https://brianmorgantutor.com/sitemap.xml` submitted to Google Search Console and report back what Google says about indexing.

## Current state

- The sitemap and robots.txt exist in the project and serve correctly in preview, but they were added after the last publish, so they are not live on brianmorgantutor.com yet.
- No Google Search Console account is connected to this project, so there is no way to submit anything or read indexing status yet.

## Steps

1. **Connect Google Search Console.** I open the connection card; you sign in with the Google account that owns (or should own) brianmorgantutor.com. This is the step that needs you.
2. **Publish the site.** The sitemap route and robots.txt need to be live at the real domain before Google can fetch them.
3. **Find or create the verified property.** I list the verified properties on your account and match brianmorgantutor.com. If none exists, I request a meta-tag verification token, add that tag to the site head, publish once more, verify, and add the property.
4. **Submit the sitemap.** Submit `https://brianmorgantutor.com/sitemap.xml` to the matched property.
5. **Report status.** Read back the sitemap's processing state (last downloaded, warnings/errors, URLs discovered) and inspect the homepage's current state in Google's index, then summarize it for you.

## What I can and cannot tell you

Submission and status reads are fully supported. What I cannot do is force a crawl or "request indexing" — that button only exists inside the Search Console UI. For a brand-new site, expect Google to take days to weeks before pages show as indexed; a freshly submitted sitemap normally reads as "pending" or "couldn't fetch yet" at first, which is not an error.

## Technical notes

- Verification, if needed, uses the META method: the tag goes in the head of `src/routes/__root.tsx` so it renders on the root URL.
- The property will be the root URL-prefix property `https://brianmorgantutor.com/`. A DNS-based Domain property is not required for sitemap submission or page reports.
- No application logic changes; the only possible source edit is the verification meta tag.
