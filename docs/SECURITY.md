# Security status and review targets

Prototype; independent review has not occurred. Target OWASP ASVS 5.0 Level 2: https://owasp.org/projects/asvs?tab=main

Implemented boundaries:
- Project data is Zod-validated; settings have allowlisted fields and bounded values.
- Version-three layout trees permit only Page sections, Section elements/column groups, groups of up to four Columns, and primitive elements inside Columns. Arbitrary recursive containers and unknown style/motion identifiers are rejected. Each Section or individual Column allows up to 20 children, and nested IDs must be unique across the project.
- Preview only executes controlled React components. User text is escaped.
- Images are locally decoded/resized and serialized to PNG/JPEG/WebP; no SVG/script embedding or remote image dependency.
- Generator validates file paths and stores authored content as JSON.
- Multiple-page routes reject traversal, reserved backend/asset paths, dynamic-route syntax and Windows device names. Page IDs are stable; header actions and nested buttons resolve through validated pages/anchors, and dangling actions block export. Button settings do not accept scripts or arbitrary external URLs. Hidden menu entries do not protect a page from public access.
- Version-one and version-two backups are validated against frozen schemas before migration to version three. The current schema bounds projects to 50 pages, 1,000 components including containers and both shared records, and a 10 MB serialized backup. The importer checks file size before parsing. Migration does not mutate its input. These are local document bounds rather than measured cloud quotas.
- The custom Outline uses controlled editor actions to insert and reorder allowed elements. Canonical child data is separate from editor slots; the exporter traverses the validated tree and includes required component sources. Empty containers and invalid destinations must be fixed before export.
- Private Supabase credentials stay server-side. Admin API validates the token with Auth and checks an owner-maintained admin membership.
- Database tables and contact RPC deny access to anonymous/ordinary authenticated users; the server alone uses service privileges.
- Administrator setup is a CLI operation with no public admin registration.
- Contact limits run transactionally in PostgreSQL: five messages per hashed email/hour, 100 globally/hour.
- No raw email addresses are stored in rate-limit buckets; those buckets expire.
- Contact submission persistence precedes optional Brevo delivery.

Known production gaps: trusted-proxy IP throttling/bot challenge, admin recovery flow, complete CSP nonce policy, email retries, retention/deletion controls, auditing/monitoring, robust abuse operations and external review. CSP currently permits inline Next.js scripts. No customer data or payments should be accepted as a production service on the basis of this prototype.

Verifier: checks original source hashes, copies no production env files, runs a unique local Supabase stack, and starts application/browser tests on a Docker internal network. Earlier business artifacts passed their real isolated runtime checks on 27 September 2026 (local date). That historical result does not automatically verify newly generated layout artifacts: see PROGRESS.md for each observed result, exact hash and evidence. Passing proves the listed prototype scenarios, not ASVS compliance or production readiness.

The runtime suite verifies contact persistence, administrator login/inbox updates, denial of anonymous/ordinary-user access and role escalation, blocked public registration, invalid origins/payloads, concurrent rate limits, and preservation of submissions when email is unconfigured or delivery fails. External access is blocked during those tests. Supabase initialization temporarily publishes local development ports, which may bind beyond localhost; run it on a trusted computer/network. The runner removes that setup network and verifies every service is exclusively attached to the internal network before testing. Test keys are redacted from CLI logs. No global Docker/firewall settings are changed.

Owners must configure their own domains, SMTP, database access, backups and secrets. Database backups do not include storage objects.
https://supabase.com/docs/guides/platform/backups
https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
