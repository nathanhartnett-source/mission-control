# Logging in & onboarding

## First login

Your admin will give you a Mission Control URL (e.g.
`https://mc.your-org.com`) and a username + temporary password. The first
time you sign in:

1. Land on the **login page** and authenticate.
2. You're sent to **onboarding** — a short wizard that asks:
   - Your display name and how you'd like to be addressed
   - Your agent's name (defaults to a friendly placeholder; pick something
     you'll enjoy saying out loud — you'll talk to it a lot)
   - Persona notes — tone, style, what you want it to know about you
3. After the wizard, MC seeds an opening message from your agent
   introducing itself in the persona you chose. Read it; reply if you want
   to refine anything.
4. A short walkthrough video plays once. You can revisit it any time at
   `/onboarding`.

Onboarding writes:
- a profile in `data/users.json`
- a persona file at `~/.claude/projects/-home-<username>/memory/persona.md`
  (this file is the source of truth for your agent's name & voice — your
  agent re-reads it every turn).

## If you reset your password

Admins reset passwords from `/settings` (admin tab). After reset, log out and
back in.

## If onboarding never appears

You're already onboarded — MC saw your persona file exists and skipped the
wizard. Edit the persona via **Settings → Agent** instead.
