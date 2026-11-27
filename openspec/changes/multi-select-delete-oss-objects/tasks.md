# Tasks

## 1. Service

- [x] 1.1 Update `OssService.deleteObjects` in `src/services/oss.ts` to continue after per-object failures and return `{ deleted, failed }` counts
- [x] 1.2 Update `deleteBucketObjects` in `src/commands/object-storage.ts` to report failures using the new return value

## 2. View and command

- [x] 2.1 Add a per-view `canSelectMany` option in `src/extension.ts` and enable it for `apsDataManagementView`
- [x] 2.2 Update `OssCommands.deleteObject` to accept `(clicked, selected)`, keep only object nodes, and fall back to the existing prompts when called from the palette
- [x] 2.3 For more than one object, show one modal confirmation with the count, then delete per bucket with a single cancellable progress notification
- [x] 2.4 Report deleted, cancelled and failed counts in the result messages, and refresh the view in all cases
- [x] 2.5 Confirm the single-object flow and messages are unchanged

## 3. package.json sync

- [x] 3.1 Confirm `aps.oss.deleteObject` still matches its registration and menu entry; no ID or placement change is expected
- [x] 3.2 Keep `package.nls.json` titles consistent (sentence case for any new text)

## 4. Docs and verification

- [x] 4.1 Add an `Added` entry to `[Unreleased]` in `CHANGELOG.md`
- [x] 4.2 Run `openspec validate --specs`
- [x] 4.3 Run `yarn typecheck`, `yarn build` and `yarn test`
- [ ] 4.4 Manually verify in the Extension Development Host: multi-select across buckets, mixed selection, cancel, and a forced failure
