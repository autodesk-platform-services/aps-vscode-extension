# Proposal

## Why

Cleaning up an OSS bucket today means deleting objects one at a time: each deletion needs a right-click, a modal confirmation, and a progress notification. The only bulk option, `aps.oss.deleteBucketObjects`, is all-or-nothing. Users who want to remove a handful of objects, such as leftovers from a failed upload run or old test files, have no efficient way to do it.

## What Changes

- Enable multi-selection (Ctrl/Cmd-click, Shift-click) of object nodes in the Data Management (app) view.
- `aps.oss.deleteObject` deletes every selected object after a single modal confirmation that states how many objects will be deleted.
- Multi-object deletion reuses the existing batched, cancellable progress behavior of "delete all objects".
- The result message reports how many objects were deleted, and the view refreshes afterwards, including on failure or cancellation.
- Selections that include non-object nodes (buckets, "Load more…") ignore those nodes. If no objects remain, the command does nothing.
- Selections spanning multiple buckets are supported; objects are deleted per bucket.
- Single-object behavior (confirmation text, message) is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `object-storage`: the "Destructive operations require confirmation" requirement gains multi-object deletion from a multi-selection. A new "Multi-selection of objects" requirement covers selecting object nodes.

## Impact

- `src/extension.ts`: the Data Management app view is created with `canSelectMany: true`.
- `src/commands/object-storage.ts`: `deleteObject` accepts the clicked item plus the selected items (VS Code passes both to tree commands).
- `src/services/oss.ts`: `deleteObjects` is reused; it may need to report failures per object rather than aborting the batch.
- `package.json`: no new command, but the `aps.oss.deleteObject` title may be generalized. `package.nls.json` must be updated to match.
- `CHANGELOG.md`: new `Added` entry.
- No new settings, dependencies, or language model tools.
