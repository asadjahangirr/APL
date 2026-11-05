# Windows setup handoff — 26 September 2026

Current project: `C:\Users\ASAD\Projects\APL`.

## Completed

- Checked Windows 10 Pro 22H2, 64-bit and approximately 16 GB RAM. E: was full when setup began; all new setup files and Docker data are on C:.
- Found that Windows system TEMP and TMP pointed to `E:\SystemCache\Temp`. The official WSL package install failed with `0x80070070` (insufficient disk space).
- With the owner's explicit approval, changed only those two machine-wide environment settings to `C:\Windows\Temp`. Existing temporary files were not moved or deleted. User-level TEMP/TMP settings were not changed.
- Saved the original values in `.local/setup/system-temp-before.json`.
- Confirmed VirtualMachinePlatform was already enabled; enabled Microsoft-Windows-Subsystem-Linux with `-NoRestart`.
- Wrote the setup result and log to `.local/setup/windows-prerequisites.json` and `.log`. The result is `restart-required` with no setup error.

## After the restart

The owner restarted Windows. Machine TEMP/TMP now resolve to C:. The original prerequisite report remains a historical record of the requested restart.

- Installed WSL 2.7.12.0 from a complete Microsoft-signed MSI. Installer exit code 0; `wsl --version` confirms the runtime and kernel 6.18.33.2. No additional restart was requested.
- Installed Docker Desktop 4.89.0 for the current user at `%LOCALAPPDATA%\Programs\DockerDesktop`. Verified its SHA-256 and valid Docker Inc signature before running it. Installer exit code 0.
- Installation results are recorded in `.local/setup/wsl-install-result.json` and `docker-install-result.json`; the WSL MSI log is retained alongside them. Docker's installation log is `%LOCALAPPDATA%\Docker\install-log.txt`.
- Started Docker Desktop. Its `docker-desktop` distribution runs with WSL version 2. `npm run doctor` passed with Node 24.13.0 and local Docker Engine 29.7.2. Initial startup and idle wake-up were slow; the engine was restarted once after an idle shutdown.
- The Windows computer-control helper is unavailable after the restart. Command-line checks confirmed that the Linux engine is running; no first-run screen or additional owner action is currently blocking verification.

## Installer references

- WSL 2.7.12 x64 installer: `https://github.com/microsoft/WSL/releases/download/2.7.12/wsl.2.7.12.0.x64.msi`. Verify a valid Microsoft Authenticode signature.
- Docker Desktop 4.89.0 installer: `https://desktop.docker.com/win/main/amd64/238018/Docker%20Desktop%20Installer.exe`.
- Docker SHA-256 reported by the official winget metadata: `854626704af28a160d5af68b96b3e32eacf08ab397ce6c12eb02a04788d73681`. Verify again against current official metadata before installation if the version changes.
- The installed configuration uses the WSL 2 / Linux-container backend and C: data storage.

## Next acceptance check

Run `npm run doctor` before verification. If Docker presents an error, record its exact text and inspect the local startup logs. Do not reset Docker data or unregister distributions as a routine troubleshooting step.

The acceptance runs exposed several Windows/runtime integration issues, which were corrected:

- Supabase could not find the newly installed Docker CLI in the terminal's old PATH. The prerequisite checker now adds the discovered CLI directory to child-process PATH.
- The machine's uppercase npm cache setting still pointed to E:. The verifier now passes a C: temporary cache explicitly to npm.
- Docker's full diagnostic `info` command timed out while builds were active. The read-only checker uses the smaller server `version` query for the engine facts it needs.
- Docker Desktop could not expose the database port from an internal-only network during Supabase initialization. The verifier initializes disposable services on a temporary setup network, then moves every service exclusively onto the internal runtime network before executing website tests. It validates all attachments and preserves service aliases.
- The pinned Supabase CLI uses `[local_smtp]` rather than the older `[inbucket]` configuration section.
- Underscores in the Docker API container name made it an invalid browser Content Security Policy source. The isolated API now receives the valid `verification-backend` network alias; the security policy is retained.
- Local test credentials are redacted from captured Supabase command output.
- The local email-provider setting had disabled administrator login as well as signup. The pinned CLI maps `auth.email.enable_signup` to `GOTRUE_EXTERNAL_EMAIL_ENABLED`; it must be true for email login. The separate global `auth.enable_signup = false` blocks registration. The runtime suite now checks both administrator login and rejection of public registration. The owner setup guide explains the same distinction for hosted Supabase.

The authentication setting behavior was verified against the pinned CLI's source: https://github.com/supabase/cli/blob/v2.118.0/apps/cli/src/commands/start/services/gotrue.service.ts. Browser test failures now print redacted console/network diagnostics without request headers or bodies.

Temporary setup ports can bind to all interfaces. A disposable probe showed that this Docker installation did not honor the bridge network's localhost binding default; an explicit per-port binding did work, but the pinned Supabase CLI does not expose that control. The verifier therefore documents setup as suitable for a trusted computer/network, not a public server. It does not claim localhost-only setup. No customer data or production credentials are loaded. Runtime tests remain isolated, and failure to remove setup connectivity stops them. No machine-wide firewall or Docker settings were changed.

After successful installation, removed only this task's nine downloaded installer/segment files (1,142,609,328 bytes). Installation logs, result reports, the original TEMP/TMP backup, and installed applications remain.

Regenerate both acceptance fixtures and run `npm run verify` inside each generated project after exporter changes. See PROGRESS.md and the generated `verification-report.json` files for the actual acceptance results. A successful compile or prerequisite check does not replace those runtime tests.

## Recovery and scope

`scripts/setup-windows.ps1` requires Windows administrator rights. The `-UseSystemTempOnC` switch is intended only when the computer owner explicitly approves that machine-wide change. The script is idempotent, retains the first backup, never reboots automatically, and never deletes old temporary files.

To reverse the environment change later, an administrator can restore the two machine-level values recorded in the backup. Do not restore the full E: path while that drive still has no free space. No Docker daemon security settings, firewall exclusions or global Git exceptions were added.

Official references:
- https://docs.docker.com/desktop/setup/install/windows-install/
- https://learn.microsoft.com/windows/wsl/install
- https://github.com/microsoft/WSL/releases/tag/2.7.12

## Verification recovery after disk cleanup

The Services acceptance work exhausted C: while Docker unpacked a test image. Removing Docker cache records releases internal cache space but does not guarantee immediate recovery of Windows free space. The owner later freed about 55 GB; Docker and the Vite builder restarted successfully, and the unchanged static export passed its runtime checks.

Use `[System.IO.DriveInfo]::new('C:\').AvailableFreeSpace` for the native free-space check. In this restricted environment, `Get-PSDrive C` sometimes returned missing values that converted to zero despite substantial free space.

The resumed contact-only proof encountered a separate stalled npm download for `@supabase/cli-windows-x64@2.118.0`. A bounded download from the official npm tarball endpoint succeeded. Its SHA-512 was checked against the exact version's registry integrity value before caching the archive. Only the stalled proof processes, their empty proof networks and the incomplete task-specific `_npx` directory were cleared. The export source and pinned CLI version were unchanged. The unchanged contact export subsequently passed all 23 independent runtime checks. See PROGRESS.md for its exact artifact hash and report.

The current verifier measures native free space on its temporary-files volume before Docker setup and refuses to proceed below 10 GiB. This is a minimum, not a guarantee for cold image downloads; Docker storage may live on another drive and needs separate headroom. No automatic cache deletion is performed. A cold Docker engine can also take time to answer read-only probes even when Docker Desktop is open; retry after it becomes responsive before considering setup changes.
