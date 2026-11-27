# Object storage

## Purpose

Browse and manage Object Storage Service (OSS) buckets and objects owned by the active environment's application (2-legged auth). Buckets and objects are shown in the app Data Management view (`apsDataManagementView`), with commands for creating, inspecting, uploading, downloading, copying, renaming, and deleting them.

Out of scope: Model Derivative translation and inspection (see `model-derivative-translation` and `model-derivative-inspection`), and the user (3-legged) Hubs view (see `data-management`).

## Requirements

### Requirement: Bucket list

The view SHALL list the buckets owned by the application in the active environment's region, sorted by bucket key. Each bucket node SHALL show its key and region, and its tooltip SHALL show key, region, and retention policy.

#### Scenario: Buckets are loaded on first expansion
- **WHEN** the view is first shown
- **THEN** the first page of buckets is fetched and listed, sorted by key

#### Scenario: Loading fails
- **WHEN** listing buckets fails
- **THEN** an error message is shown and the view stays empty

### Requirement: Pagination

Buckets and objects SHALL be fetched one page at a time. The page size SHALL come from `autodesk.forge.data.pageSize` (clamped to 1–100; default 32). When more items remain, a trailing "Load more…" node SHALL be shown; selecting it (`aps.oss.loadMore`) SHALL fetch the next page and append it to that parent only.

#### Scenario: More pages available
- **WHEN** a page is returned with a continuation token
- **THEN** a "Load more…" node follows the loaded items

#### Scenario: Loading the next page
- **WHEN** the user selects "Load more…" under a bucket
- **THEN** the next page of that bucket's objects is appended, and no other node is refreshed

#### Scenario: Last page reached
- **WHEN** a page is returned without a continuation token
- **THEN** no "Load more…" node is shown

#### Scenario: Refresh discards loaded pages
- **WHEN** the user runs `aps.oss.refreshBuckets`
- **THEN** all loaded pages and continuation tokens are discarded and the list is fetched again from the first page

### Requirement: Object list and prefix filter

Expanding a bucket SHALL list its objects, sorted by object key. Each object node SHALL show its key, and its tooltip SHALL show key, ID, and size in bytes. The user SHALL be able to restrict a bucket's objects to keys starting with a prefix (`aps.oss.filterObjects`) and clear that restriction (`aps.oss.clearObjectsFilter`).

#### Scenario: Setting a filter
- **WHEN** the user runs `aps.oss.filterObjects` on a bucket and enters a prefix
- **THEN** only objects whose keys start with the prefix are listed, the bucket shows `filter: <prefix>`, and pagination restarts from the first page

#### Scenario: Prefilled input
- **WHEN** a filter is already active and the user runs `aps.oss.filterObjects` on that bucket
- **THEN** the input box is prefilled with the current prefix

#### Scenario: Clearing by empty input
- **WHEN** the user submits an empty prefix
- **THEN** the filter is cleared

#### Scenario: Cancelling the prompt
- **WHEN** the user dismisses the prefix input
- **THEN** the current filter is unchanged

#### Scenario: Clear command availability
- **WHEN** a bucket has an active filter
- **THEN** `aps.oss.clearObjectsFilter` is available inline on that bucket, and is not shown for unfiltered buckets

### Requirement: Object derivative status

Expanding an object node SHALL show the Model Derivative status of that object, derived from its URN.

#### Scenario: Translation succeeded
- **WHEN** the object's manifest status is `success`
- **THEN** its derivatives are listed, sorted by name

#### Scenario: Translation failed
- **WHEN** the manifest status is `failed`
- **THEN** a "Translation failed (hover for more info)" hint is shown, with the failure messages in its tooltip

#### Scenario: Translation in progress
- **WHEN** the manifest is neither `success` nor `failed`
- **THEN** a "Translation in progress (<progress>)" hint is shown and the node refreshes itself after one second

#### Scenario: No manifest
- **WHEN** no manifest exists for the object
- **THEN** a "No derivatives yet (hover for more info)" hint is shown

### Requirement: Create bucket

`aps.oss.createBucket` SHALL prompt for a bucket name and a retention policy (`transient`, `temporary`, or `persistent`), create the bucket in the environment's region, and refresh the view. The command SHALL be available in the view's title bar.

#### Scenario: Successful creation
- **WHEN** the user enters a name and selects a policy
- **THEN** the bucket is created, "Bucket created: <key>" is shown, and the view refreshes

#### Scenario: Cancelled input
- **WHEN** the user dismisses the name or policy prompt
- **THEN** no bucket is created

#### Scenario: Creation fails
- **WHEN** the API rejects the request (for example, the name is taken)
- **THEN** a "Could not create bucket" error is shown

### Requirement: Inspect and copy keys

The user SHALL be able to view the full details of a bucket (`aps.oss.viewBucketDetails`) or object (`aps.oss.viewObjectDetails`) as read-only JSON, and copy a bucket key (`aps.oss.copyBucketKey`) or object key (`aps.oss.copyObjectKey`) to the clipboard with a confirmation message.

#### Scenario: Viewing details
- **WHEN** the user runs a view-details command on a bucket or object
- **THEN** its details open in a read-only JSON document

#### Scenario: Run from the command palette
- **WHEN** any command that targets a bucket or object is invoked without a tree node
- **THEN** the user is prompted to pick a bucket and, for object commands, an object in it, and the command does nothing if they dismiss the picker

### Requirement: Upload objects

`aps.oss.uploadObject` SHALL upload local files to a bucket. Files SHALL be chosen with an open dialog (multi-select, starting in the folder last used), or supplied by dropping files from the OS file explorer onto a bucket node. Uploads SHALL show a cancellable progress notification and SHALL stream the file in chunks rather than loading it into memory, so files larger than 2 GiB are supported. Failed chunks SHALL be retried, and expired upload URLs SHALL be re-requested.

#### Scenario: Uploading a single file
- **WHEN** one file is selected
- **THEN** the user is asked for an object name (defaulting to the file name), and the file is uploaded with the content type from `autodesk.forge.data.defaultContentType`, or one picked from a list if that setting is empty

#### Scenario: Name without extension
- **WHEN** the entered object name has no file extension
- **THEN** a warning says the object cannot be translated by Model Derivative

#### Scenario: Uploading multiple files
- **WHEN** several files are selected or dropped
- **THEN** each is uploaded in parallel under its file name, with no name or content-type prompts

#### Scenario: Dropping non-file items
- **WHEN** the dropped items include folders, non-`file` URIs, or inaccessible paths
- **THEN** those items are ignored, and nothing happens if no files remain

#### Scenario: Dropping outside a bucket
- **WHEN** files are dropped anywhere other than on a bucket node
- **THEN** nothing is uploaded

#### Scenario: Upload completes
- **WHEN** an upload finishes
- **THEN** "Upload complete" is shown with "Translate" and "Translate (Custom)" actions that start `aps.md.translateObject` or `aps.md.translateObjectCustom` for the new object, and the view refreshes

#### Scenario: Upload cancelled
- **WHEN** the user cancels the progress notification
- **THEN** the upload stops and "Upload cancelled" is shown, with no error

### Requirement: Create empty object

`aps.oss.createEmptyObject` SHALL prompt for an object name and create a zero-byte object with that key in the chosen bucket, recording the content type from `autodesk.forge.data.defaultContentType` (or one picked from a list if that setting is empty), then refresh the view.

#### Scenario: Successful creation
- **WHEN** the user enters a name
- **THEN** the object is created with the configured content type and "Object created: <objectId>" is shown

#### Scenario: Empty name
- **WHEN** the user dismisses the name prompt or submits an empty name
- **THEN** no object is created

### Requirement: Copy and rename objects

`aps.oss.copyObject` SHALL create a copy of an object under a new key in the same bucket. `aps.oss.renameObject` SHALL copy the object to the new key and then delete the original. Both SHALL refresh the view.

#### Scenario: Copying
- **WHEN** the user enters a new key
- **THEN** a copy exists under the new key and the original is kept

#### Scenario: Renaming
- **WHEN** the user enters a new key
- **THEN** the object exists only under the new key, and a message warns that derivatives made for the old key are no longer reachable until the object is renamed back or translated again

#### Scenario: Cancelled input
- **WHEN** the user dismisses or empties the new-key prompt
- **THEN** nothing changes

### Requirement: Download object

`aps.oss.downloadObject` SHALL ask the user where to save the object (defaulting to the object key) and download its content to that path with a cancellable progress notification.

#### Scenario: Download completes
- **WHEN** the download finishes
- **THEN** "Download complete" is shown with an "Open File" action

#### Scenario: Download cancelled
- **WHEN** the user cancels the progress notification
- **THEN** "Download cancelled" is shown, with no error

#### Scenario: Save dialog dismissed
- **WHEN** the user dismisses the save dialog
- **THEN** nothing is downloaded

### Requirement: Generate signed URL

`aps.oss.generateSignedUrl` SHALL ask for an access level (`read`, `write`, or `readwrite`), create a signed URL for the object, and show it with its expiration.

#### Scenario: Copying the URL
- **WHEN** the signed URL is shown
- **THEN** a "Copy URL to Clipboard" action copies it

### Requirement: Destructive operations require confirmation

Deleting an object (`aps.oss.deleteObject`), a bucket (`aps.oss.deleteBucket`), or all objects in a bucket (`aps.oss.deleteBucketObjects`) SHALL require confirmation in a modal dialog stating that the action cannot be undone. The view SHALL refresh afterwards, including when the operation fails.

#### Scenario: Deleting an object or bucket
- **WHEN** the user confirms
- **THEN** the item is deleted and a confirmation message is shown

#### Scenario: Declining
- **WHEN** the user dismisses the dialog
- **THEN** nothing is deleted

#### Scenario: Deleting all objects
- **WHEN** the user confirms "Delete All"
- **THEN** objects are deleted in parallel batches of 8 with a cancellable progress notification, and cancelling stops further deletions

#### Scenario: Bucket has no objects
- **WHEN** `aps.oss.deleteBucketObjects` finds no objects
- **THEN** "No objects to delete" is shown and no confirmation is requested

### Requirement: Menu placement

View-title buttons SHALL include refresh (`aps.oss.refreshBuckets`) and create bucket (`aps.oss.createBucket`). Bucket nodes SHALL offer view details, copy key, upload, create empty object, delete all objects, delete bucket, and an inline filter button. Object nodes SHALL group view details and copy key under a "View" submenu, download, rename, copy, and signed URL under an "Actions" submenu, and offer delete directly. The menus SHALL be declared in `package.json` and kept in sync with the registered command IDs.

#### Scenario: Context menu on an object
- **WHEN** the user right-clicks an object node
- **THEN** the object commands are offered, and the bucket-only commands are not
