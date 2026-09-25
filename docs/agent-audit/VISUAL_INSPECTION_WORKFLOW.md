# Visual inspection workflow

The production workspace remains `/home/user/Azmoonsaz-audit`. A disposable, Supabase-free inspection copy is maintained at `/home/user/Azmoonsaz-visual-inspection`.

The inspection copy currently provides a deterministic component/state gallery covering:

- Light and dark appearance switching
- Surface/elevation relationships
- Shared button and field states
- Semantic status surfaces
- Dense table contrast and compact spacing
- LTR identifiers inside RTL content
- A fixed 320 px mobile frame

Run it with `npm run dev` and open `/inspection.html`. Inspection-only files must not be copied wholesale into production. Production-safe token, component, accessibility, and responsive fixes are applied deliberately to the main workspace and receive the full validation suite there.

This separation prevents fake authentication or fixture data from leaking into production while allowing visual work without Supabase credentials.
