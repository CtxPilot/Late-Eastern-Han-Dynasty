# Third-Party Notices

This project is MIT-licensed, but its dependency graph and optional local font assets retain their
respective licenses. The authoritative release inventory is generated from `pnpm-lock.yaml` with:

```bash
pnpm licenses list --json
```

The 2026-08-01 baseline contained 265 package entries: MIT 243, ISC 11, Apache-2.0 5,
BSD-3-Clause 5, and CC-BY-4.0 1.

## CC BY 4.0

`caniuse-lite` is reported by the package manager as CC-BY-4.0 browser compatibility data.
Project/source: https://github.com/browserslist/caniuse-lite
License: https://creativecommons.org/licenses/by/4.0/

No project endorsement by the upstream authors is implied. If a release modifies or directly
redistributes the licensed dataset, the release notes must identify the modification. Build-time
analysis must determine whether the dataset is present in the shipped artifact.

## Font software

Noto Serif CJK SC and Ma Shan Zheng are licensed under the SIL Open Font License 1.1. When font
binaries are shipped, `client/public/fonts/OFL-1.1.txt`, the upstream copyright information and
the checksum/source table in `client/public/fonts/README.md` must ship with them.

## Remaining dependencies

MIT, ISC, BSD-3-Clause and Apache-2.0 copyright/license notices are retained in installed packages.
Every public release must attach the complete JSON license report or an equivalent human-readable
notices file generated from the exact frozen lockfile; this summary is not a substitute for it.
