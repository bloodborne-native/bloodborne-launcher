# New-version notifications

[← Documentation](README.md)

The launcher checks the stable releases of
[bloodborne-mac](https://github.com/bloodborne-native/bloodborne-mac/releases) against the version
built into the installed app: `CARGO_PKG_VERSION`, the launcher's version, which bloodborne-mac's
`packaging/version.sh` keeps equal to the app's (semantic version order; drafts and prereleases
ignored; launcher commits never notify).

**Release candidates.** A candidate's tag (`v0.9.0-rc.2`) is not written into the files:
`version.sh` keeps the release's number (`0.9.0`) there and the tag alone makes it a candidate. So a
candidate build reports `0.9.0`; it is not told about newer candidates (prereleases are ignored),
and the final `v0.9.0` is not newer than it (equal versions). Testers of a candidate find the
final release on the release page themselves. This is a known gap; closing it needs the candidate
number in the build or a prerelease channel.

- After profile setup it checks at startup and every six hours while visible.
- A newer release opens a changelog modal (the release's GitHub notes as Markdown: headings,
  lists, emphasis; no raw HTML, images or active links) once per release tag, and a banner with
  **Changelog** and dismiss. **View release** opens the release page; download and installation
  are manual, and nothing in the app or the saves is changed.
- **Advanced → Updates:** the installed version, the check status, **Check now**, and **Check for
  new versions automatically** (`check_updates`, on by default; manual checks always work).
- Offline, rate limits and bad responses show a retryable status and never block Play. Requests
  carry no account, token or player data; 10-second timeout, 512 KiB limit.

Rust fetches GitHub's latest-release endpoint (reqwest, rustls); TanStack Query shares the result
(six-hour freshness). Only validated stable tags on the app's release page are opened. Native
tests cover version order, build metadata, draft and prerelease exclusion, bad responses, missing
notes and link validation. Browser preview: `?update&lang=en` supplies a synthetic newer release.
