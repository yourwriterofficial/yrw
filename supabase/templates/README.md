# Supabase Auth email templates — YourResearchWriter

Paste each file into **Supabase Dashboard → Authentication → Emails**, matching
the file to the template of the same name.

| File | Supabase template | Suggested subject |
|---|---|---|
| `confirm-signup.html` | Confirm your email | Confirm your email |
| `invite-user.html` | You have been invited | You have been invited |
| `magic-link.html` | Your sign-in link | Your sign-in link |
| `change-email.html` | Confirm your new email | Confirm your new email |
| `reset-password.html` | Reset your password | Reset your password |
| `reauthentication.html` | Confirm it is you | Confirm it is you |

## Why every template includes the 6-digit code

The stock Supabase templates contain a link only (`{{ .ConfirmationURL }}`).
An app that asks the user to type a code therefore has nothing to type — which
is the exact mismatch these replace. Each template here shows **both** the
button and `{{ .Token }}`, so either route works.

`reauthentication.html` is code-only on purpose: Supabase does not provide a
`ConfirmationURL` for that template.

## Also set

- **Authentication → URL Configuration → Site URL**: your deployed origin.
- **Redirect URLs**: add the deployed origin and `http://localhost:5173` (or
  your dev port) so links work in both places.
- Token expiry lives under **Authentication → Providers → Email** if the
  "expires in" wording here needs to change.

## Testing

Send yourself one of each from the dashboard's preview, then check it in a
mobile client and a desktop client. The layout is table-based with inline CSS
because Gmail and Outlook strip `<style>` blocks and ignore flex/grid.
