# Supabase first-run checklist

1. Open Supabase dashboard.
2. Go to SQL Editor.
3. Run `supabase/schema-security-draft.sql`.
4. Go to Authentication and create a teacher user.
5. Copy the teacher user UUID from Supabase Auth users table.
6. Insert a matching row into `teacher_profiles` using that UUID.

Example:

```sql
insert into public.teacher_profiles (id, full_name, school_name)
values ('PASTE_TEACHER_AUTH_USER_UUID', 'Teacher Name', 'School Name');
```

For a test student, first generate the national ID hash locally:

```powershell
npm run hash:national-id -- 0012345678
```

Use the printed `national_id_hash` and `national_id_last4` in SQL inserts. Do not store plain national IDs in production.
