# v2 — Windows and Linux

## Acceptance criteria
- [ ] `ProcessProvider` implementations for win32 and linux behind the existing interface
- [ ] Linux: `/proc` or `ps`; ports via `ss -ltnp`. Windows: `Get-NetTCPConnection` + `Get-CimInstance Win32_Process` (PowerShell, arg arrays)
- [ ] Safety model equivalents (user-owned only, allowlist, protected system paths)
- [ ] Tray behavior per platform; installers (NSIS/AppImage or deb) and signing plan (Windows code signing)
- [ ] CI matrix builds on all platforms; platform-specific tests

## Notes
Do not start until v1.1 is stable. Keep platform code out of services; only providers know the OS.
