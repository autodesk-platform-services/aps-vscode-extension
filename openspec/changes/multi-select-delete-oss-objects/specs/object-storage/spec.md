# Spec Delta

## ADDED Requirements

### Requirement: Multi-selection of objects

The Data Management (app) view SHALL allow selecting several nodes at once. Commands applied to a selection SHALL act on the selected object nodes only and SHALL ignore other node types.

#### Scenario: Selecting objects across buckets
- **WHEN** the user selects object nodes from more than one bucket and runs `aps.oss.deleteObject`
- **THEN** each selected object is deleted from its own bucket

#### Scenario: Mixed selection
- **WHEN** the selection contains object nodes and other nodes such as buckets or "Load more…"
- **THEN** only the object nodes are deleted, and the confirmation counts only those

#### Scenario: Selection without objects
- **WHEN** `aps.oss.deleteObject` runs on a selection that contains no object nodes
- **THEN** nothing is deleted and no confirmation is shown

#### Scenario: Context menu on a multi-selection
- **WHEN** the user right-clicks within a selection of several object nodes
- **THEN** the delete command is offered

## MODIFIED Requirements

### Requirement: Destructive operations require confirmation

Deleting one or more selected objects (`aps.oss.deleteObject`), a bucket (`aps.oss.deleteBucket`), or all objects in a bucket (`aps.oss.deleteBucketObjects`) SHALL require confirmation in a modal dialog stating that the action cannot be undone. The view SHALL refresh afterwards, including when the operation fails.

#### Scenario: Deleting an object or bucket
- **WHEN** the user confirms
- **THEN** the item is deleted and a confirmation message is shown

#### Scenario: Declining
- **WHEN** the user dismisses the dialog
- **THEN** nothing is deleted

#### Scenario: Deleting several selected objects
- **WHEN** the user selects several object nodes, runs `aps.oss.deleteObject`, and confirms the dialog, which states the number of objects
- **THEN** all selected objects are deleted in parallel batches of 8 with a cancellable progress notification, and a message reports how many were deleted

#### Scenario: Declining a multi-object deletion
- **WHEN** the user dismisses the dialog for several selected objects
- **THEN** nothing is deleted

#### Scenario: Cancelling a multi-object deletion
- **WHEN** the user cancels the progress notification
- **THEN** no further deletions start, and the message reports how many objects were deleted before cancelling

#### Scenario: Some deletions fail
- **WHEN** deleting one or more of the selected objects fails
- **THEN** the remaining objects are still processed, and an error message reports how many objects could not be deleted

#### Scenario: Deleting all objects
- **WHEN** the user confirms "Delete All"
- **THEN** objects are deleted in parallel batches of 8 with a cancellable progress notification, and cancelling stops further deletions

#### Scenario: Bucket has no objects
- **WHEN** `aps.oss.deleteBucketObjects` finds no objects
- **THEN** "No objects to delete" is shown and no confirmation is requested
