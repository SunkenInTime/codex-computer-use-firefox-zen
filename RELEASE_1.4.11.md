# 1.4.11 release candidate

Fixes direct Codex tab attachment failing with
`Firefox CDP compatibility layer does not implement Page.setLifecycleEventsEnabled`.
The add-on and native/npm companion versions are synchronized at 1.4.11.
No new add-on permissions or upstream bundle changes are included.

## Verification

- `npm test`: passed, including the regression that fails against 1.4.10.
- `npm test --prefix npm`: passed on macOS (Linux-only install tests run in CI).
- `FIREFOX_BINARY=/Applications/Zen.app/Contents/MacOS/zen npm run test:live`:
  passed using a disposable headless profile, with foreground-tab preservation.
- `npx --yes web-ext lint --source-dir extension --no-input`: zero errors,
  zero notices, 72 warnings from the existing distribution.
- PR Verify workflow tests Windows, macOS, and Linux and attaches a
  `release-candidate` artifact containing the extension ZIP, matching source ZIP,
  SHA-256 files, and npm tarball.

The isolated test verifies real Firefox WebExtension behavior, not the full
signed-in Codex transport. Before publishing, test the release candidate in a
separate signed-in development profile: attach to an inactive tab with
`cua.getTab`, read its state, and confirm the user's active tab stays selected.
The user's installed extension and native bridge have not been replaced.

## Publication sequence

1. Merge the reviewed PR and confirm Verify is green for the merged commit.
2. Update the changelog's Unreleased date if needed. Tag the chosen release
   commit `v1.4.11` and push that tag to run Release.
3. Wait for all release builds, GitHub asset publication, npm provenance
   publication, and macOS/Linux public-install smoke tests to succeed.
   npm now waits for the GitHub assets its installer downloads; manual
   workflow_dispatch only builds candidates and does not publish npm.
4. Submit `codex-computer-use-firefox-zen-1.4.11.zip` as a new version of the
   existing AMO listing, keeping `codex-computer-use-firefox-zen@sunkenintime`.
   Attach the matching `-source.zip`, use AMO_LISTING.md reviewer notes, and
   include the release notes below. Wait for Mozilla validation/signing.
5. Verify the signed AMO version with `codex-firefox-bridge@1.4.11 doctor` and
   repeat background-tab attachment on a separate development profile.

No tag, public npm version, or AMO submission is created by this PR.

## Store release notes

Fixed a compatibility error that prevented Codex from connecting directly to
Firefox and Zen tabs. Added page lifecycle notifications and regression
coverage to keep tab attachment from switching the active tab. Update the
native bridge to 1.4.11 to match the add-on version.
