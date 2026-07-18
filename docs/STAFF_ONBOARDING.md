# Staff account onboarding

All enabled staff have the same application permissions. `staff.role` remains
`admin` only to satisfy the original schema; access is controlled by
`staff.is_active` and the linked Supabase Auth user.

## Create each account

In the Supabase Dashboard, open **Authentication → Users → Add user**. Create
one email-and-password account for each person:

- Henry
- Angela
- Harry
- Terrence

Use a private work email for each account and share the initial password only
with that person. Do not add a service-role key to the browser.

The database trigger automatically creates an inactive row in `public.staff`
for every new Auth user. In **Table Editor → staff**, set the matching row's
`display_name` to the person's name and set `is_active` to `true`.

## Security behaviour

- An Auth user with no active staff row is redirected back to `/login`.
- Every enabled staff member has the same full operational permissions.
- Every insert, update, and delete on operational tables creates an immutable
  `activity_logs` record with the acting staff member, time, entity, and
  before/after data.
