# Contributing to Omni UI Mobile Signatures

## Branches

| Branch   | Holds                                                     | Who writes it                    |
| -------- | --------------------------------------------------------- | -------------------------------- |
| `main`   | Only the files Bubble syncs: `elements/`, `actions/`, `README.md`, `meta_data.json`, `shared_tech_params.json` (and `html_headers.html` where the plugin has one) | Bubble, and release pull requests |
| `source` | Everything on `main` plus the source, scripts, tests and these docs | Feature pull requests            |

When you push from Bubble's plugin editor, Bubble commits a full snapshot of the
plugin and deletes every other file on `main`. Source, tests and tooling therefore
live on `source`, which Bubble never touches, and `source` is never merged into
`main`. Release a change by copying the shipped files from `source` to `main` in a
pull request, or by entering them in Bubble's plugin editor.

## Setup

Node 22 or later.

```sh
git checkout source
npm ci
```

The source's own notes (architecture, contracts, preview) are in `docs/source.md`.

## Making a change

1. Branch from `source` and edit the TypeScript in `src/`.
2. `npm run build` writes the bundles to `dist/` (not committed).
3. `npm run ship` copies them into the Bubble folders under `elements/` (and
   `actions/`), matched by display name through `bubble-plugin-builder.json`.
4. `npm run check` typechecks, runs the tests, builds, smoke-tests the bundles and
   confirms every shipped file matches the build (`npm run check:shipped`).
5. Commit `src/` and the updated shipped files together, then open a pull request
   into `source`.

What ships from where:

- **Web Signature Pad**: `initialize.js`, `update.js`, `reset.js` and the four
  element actions are built from `src/`. Its `preview.js` on `main` is the build
  from before private uploads were added (the editor preview never reads those
  settings), so it is not shipped yet: rebuilding it only adds unused config
  reads. When you next change the preview, add `preview.js` to the web element's
  `files` in `bubble-plugin-builder.json` and ship it.
- **Mobile Signature Pad**: `element_source/component.js` is plain JavaScript,
  not built; `npm run ship` copies it as it is. The mobile element's
  `preview.js`, `reset.js` and element action `run.js` files exist only on `main`
  (hand-written in Bubble's editor) and are not managed from here.

## Keeping `source` in step with `main`

`main` is what Bubble runs. When Bubble commits to `main` (an "Automatic commit
from Bubble"), merge `main` into `source` so the shipped files here stay the
same as Bubble's:

```sh
git checkout source
git merge origin/main
npm run check
```

If `check:shipped` then reports a difference, Bubble's copy was edited outside
this source. Port that change into `src/` before building again; otherwise the
next `npm run ship` overwrites it.
