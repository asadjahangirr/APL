// The builder and exported websites use the same read-only prerequisite check.
import '../templates/base/scripts/doctor.mjs';
if (process.exitCode) console.error('Builder setup instructions: docs/WINDOWS-SETUP.md.');
