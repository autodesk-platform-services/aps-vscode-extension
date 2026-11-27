# Design

## Context

- The Data Management app view (`apsDataManagementView`) is created in `src/extension.ts` through a shared loop of `vscode.window.createTreeView` calls. None of the views set `canSelectMany`, so only one node can be selected today.
- `OssCommands.deleteObject(object?)` handles one object, with its own modal and `withProgress` call. `deleteBucketObjects` already has the batched, cancellable flow, using `OssService.deleteObjects(bucketKey, keys, { onProgress, isCancelled })`.
- VS Code invokes tree-item commands with `(clickedItem, allSelectedItems)` when `canSelectMany` is enabled. Both arguments are absent when the command runs from the palette.
- Object nodes are expandable (they show derivatives), so a selection may include derivative nodes too.

## Goals / Non-Goals

**Goals:**
- Delete many selected objects with one confirmation and one progress notification.
- Keep single-object behavior and the palette flow unchanged.

**Non-Goals:**
- Multi-select for other commands (download, copy, rename, signed URL).
- Multi-select in other views, or selecting objects with a pattern or "select all in bucket".
- A new command ID or a language model tool.

## Decisions

1. **Reuse `aps.oss.deleteObject` instead of adding a command.** The ID, `package.json` entry and menu placement stay as they are, so the sync burden is minimal. Alternative: a separate `aps.oss.deleteObjects` command. Rejected because it would show two similar entries in one context menu.
2. **Enable `canSelectMany` for the data-management view only.** The shared loop in `extension.ts` gets a per-view option, as it already does for `dragAndDrop`. Other views keep single selection.
3. **Normalize the arguments at the top of the handler.** Take the second argument if it is a non-empty array, otherwise `[clicked]`, and keep nodes that are objects. With zero results, return silently. One result takes the existing single-object path, so its messages are unchanged.
4. **Group by bucket, then call `deleteObjects` per bucket.** The service method is already batched. Progress is aggregated across buckets so that one notification shows total progress.
5. **Make `deleteObjects` resilient.** Today a rejected promise aborts the remaining batches. The service SHALL collect failures and return the deleted and failed counts, so the command can report them. This keeps `deleteBucketObjects` working, since it can ignore the return value.

## Risks / Trade-offs

- Changing `deleteObjects` to swallow per-object errors changes `deleteBucketObjects` failure behavior. Mitigation: the command reports failed counts there too.
- Large selections can hit APS rate limits. The existing batch size of 8 is retained.
- Selecting an object and its derivative together is harmless, since derivative nodes are filtered out.
