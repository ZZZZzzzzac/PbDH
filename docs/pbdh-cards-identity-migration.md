# PbDH Cards Identity Migration

Source repository: `PbDH_Cards`

Source commit: `0745f4e45d6bc1cb06bc7f5d7b005757546c5cbe`

Selected sources:

- `server/database.py`: ordered SQLite migrations, foreign keys, WAL and initialization locking.
- `server/identity/repository.py`: stable public identity mapping, transactional session claim, replacement diagnostics and username normalization.
- `server/identity/tokens.py`: injectable Token Verifier and Supabase JWT verification.
- `server/identity/router.py`: protected-request ownership derived from verified identity rather than client IDs.
- `frontend/src/auth/`: optional Supabase configuration, session gateway and shared client state.
- `frontend/src/components/AccountControl.tsx`: account entry and explicit session replacement behavior.
- `tests/test_identity.py` and `frontend/src/auth/AuthContext.test.tsx`: authentication, replacement and anonymous fallback evidence.

Migration boundary:

- Preserve external behavior and translate tests into the current FastAPI and React workspace structure.
- Do not copy the old database, runtime data, email handling or `role` column.
- Normal PbDH Accounts have no role. One configured shared Admin auth subject is handled outside Account rows per ADR-0056.
- Supabase remains auth-only; the Platform Backend owns stable Account IDs, active sessions and all product data.
