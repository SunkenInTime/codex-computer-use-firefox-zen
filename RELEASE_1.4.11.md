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

## CI authentication

npm uses its existing trusted publisher for GitHub Actions: owner
`SunkenInTime`, repository `codex-computer-use-firefox-zen`, workflow
`release.yml`. `publish-npm` requests a short-lived OIDC identity and publishes
with provenance; no npm token secret is required. The 1.4.10 release successfully
used this path. Current account-side trust settings still require npm account
access to inspect; a local unauthenticated `npm trust list` does not test CI auth.

For Firefox Add-ons, create or retrieve API credentials from
<https://addons.mozilla.org/developers/addon/api/key/> using an account that is
an author of the existing add-on. Add these repository Actions secrets:

- `AMO_JWT_ISSUER`: the JWT issuer/API key.
- `AMO_JWT_SECRET`: the JWT secret/API secret.

Do not commit or paste the secret into an issue, PR, or chat. Test access without
uploading a version:

```sh
gh workflow run release.yml --ref main -f check_auth=true
```

Before this PR is merged, use `--ref fix/firefox-lifecycle-attachment` instead.
This mode runs only the authenticated, read-only add-on ownership check. The
same check gates tag publication so missing or invalid AMO credentials prevent
the GitHub/npm release from starting. Manual dispatch with `check_auth=false`
builds candidates only, including when the selected ref is a tag.

## Publication sequence

1. Merge the reviewed PR and confirm Verify is green for the merged commit.
2. Update the changelog's Unreleased date if needed. Tag the chosen release
   commit `v1.4.11` and push that tag to run Release.
3. Wait for the AMO auth check, all release builds, GitHub asset publication, npm provenance
   publication, and macOS/Linux public-install smoke tests to succeed.
   npm now waits for the GitHub assets its installer downloads; manual
   workflow_dispatch only builds candidates and does not publish npm.
4. The `publish-amo` job then submits an update to the existing listed add-on,
   using the manifest ID, matching source archive, changelog release notes, and
   AMO_LISTING.md reviewer notes. It submits with `web-ext sign --channel listed`
   and `--approval-timeout 0`: CI does not wait for human approval. A successful
   job confirms submission, not Mozilla approval or public availability. Check
   the AMO developer dashboard for validation/signing or requests from reviewers.
5. Verify the signed AMO version with `codex-firefox-bridge@1.4.11 doctor` and
   repeat background-tab attachment on a separate development profile.

No tag, public npm version, or AMO submission is created by this PR.

## Store release notes

Fixed a compatibility error that prevented Codex from connecting directly to
Firefox and Zen tabs. Added page lifecycle notifications and regression
coverage to keep tab attachment from switching the active tab. Update the
native bridge to 1.4.11 to match the add-on version.
