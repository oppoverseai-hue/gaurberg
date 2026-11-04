# Early-access waitlist (ACC-5, ACC-6)

How it works:
1. A visitor clicks "Continue with Google" on the home page.
2. Invited accounts (on the allowlist) go straight to search.
3. Anyone else sees the request-access form: role, tools used today, first company to map, open to a call, consent to emails. Name and email come from Google.
4. On submit, a row is saved in `public.waitlist` and a confirmation email goes out ("You're on the Gaurberg list").
5. The admin page lists every request with its answers, country and source (UTM tags or referring site from the first visit). "Invite" adds the email to the allowlist as a reviewer, marks the row invited and sends the invitation email.

Table and rules: `db/migrations/0016_waitlist.sql` (applied Nov 4, 2026). A person can create and read only their own row; only the admin reads all rows and invites.

## Setup (admin, Vercel → Project → Settings → Environment Variables, Production)

- `GMAIL_USER` = `oppoverseai@gmail.com`
- `GMAIL_APP_PASSWORD`: a Google app password for that account (Google Account → Security → 2-Step Verification must be on → App passwords → create one named "Gaurberg"). Paste the 16 characters without spaces. Never commit it.
- `SUPABASE_SERVICE_ROLE_KEY` (also used by the daily refresh): lets the server record that the confirmation email was sent.
- Optional `NEXT_PUBLIC_SITE_URL` if the site moves off gaurberg.vercel.app (used for the button in emails).

Without the Gmail variables the form still saves requests; the admin page then shows "confirmation not sent".

Gmail allows about 500 emails a day from one account. Moving to a custom domain later means swapping the transport in `app/src/lib/mail.ts`.

The look of the form and the emails is interim, in the app's own style. The Stitch designs replace the look, not the fields.
