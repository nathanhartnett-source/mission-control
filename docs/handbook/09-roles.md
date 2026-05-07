# Roles & what you can do

Mission Control has three roles:

| Role     | Talk to your agent | Edit wiki | Manage users | Run system updates | Bash / install |
|----------|--------------------|-----------|--------------|--------------------|----------------|
| `client` | ✅                  | ❌         | ❌            | ❌                  | ❌              |
| `staff`  | ✅                  | ✅         | ❌            | ❌                  | ✅ (full agent) |
| `admin`  | ✅                  | ✅         | ✅            | ✅                  | ✅ (full agent) |

## Client (the most common case)

You can:
- Chat with your agent (text or voice)
- Read the wiki and your project pages
- Build, run, and share apps in My Apps
- Manage your own to-do list, projects, and persona

You **cannot**:
- Run shell commands or install software via your agent (the agent's
  permission surface is restricted — Read / Edit / Write / Glob / Grep /
  TodoWrite / WebFetch / WebSearch)
- Edit other users' work or see their workspaces
- Update or restart MC itself

If you need something that requires shell or admin access, your agent will
say so and tell you to ask the system admin.

## Staff

Internal trusted users. Same permission surface as admin in the agent
runner (full Bash, broad `--add-dir`), but no user-management UI. Suited
for team members who help build apps, maintain the wiki, and run server-side
scripts on behalf of the org.

## Admin

Full control. The admin role is configured in `data/users.json` (legacy:
`isAdmin: true`; current: `role: "admin"`).

Admins can:
- Add / remove / edit users
- Assign roles
- Update MC (`Settings → System → Update`)
- See everything client and staff users can see, plus install-level config

## Switching roles

Done by an admin in Settings → Users. Roles change on next login.
