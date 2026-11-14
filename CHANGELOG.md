# Changelog

Release notes for Guide Master. `/releasenow` adds a section here for every release, and the GitHub release notes
are taken from it. Earlier versions are described in the README and the in-game update notice.

## Unreleased

### Added
- An Android app (APK), a Windows installer and the single-file offline game with every release.
- A beta at `/beta/` with its own saves, so new versions can be tried without touching your career.

### Changed
- Releases go through the shared Krazow release kit (`/releasenow`, then `/releasenow promote`). Pushing to `main`
  no longer changes the live game. The service worker's `PREFIX` is now `CACHE_PREFIX` (and `tools/build.py` keeps it in step).
