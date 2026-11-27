# Model derivative inspection

## Purpose

Inspect the results of Model Derivative translations without leaving the editor: the list of viewables (`aps.md.listViewables`), a viewable's object tree (`aps.md.viewDerivativeTree`) and properties (`aps.md.viewDerivativeProps`), the object manifest (`aps.md.viewObjectManifest`), and thumbnails (`aps.md.viewObjectThumbnail`). JSON results open as read-only editor documents.

Out of scope: starting or deleting translations (see `model-derivative-translation`), the viewer (see `viewer-preview`), and the derivative status nodes under objects in the tree (see `object-storage`).

## Requirements

### Requirement: Command entry points

Object-level commands (`aps.md.listViewables`, `aps.md.viewObjectManifest`, `aps.md.viewObjectThumbnail`) SHALL be offered on OSS objects in `apsDataManagementView` and on versions in `apsHubsView`; `aps.md.listViewables` SHALL be in the Model Derivative submenu, and manifest and thumbnails in the view group of the context menu. Derivative-level commands (`aps.md.viewDerivativeTree`, `aps.md.viewDerivativeProps`) SHALL be offered on derivative nodes (`viewItem == derivative`). Run without a target, an object-level command SHALL prompt for a bucket and an object; a derivative-level command SHALL additionally prompt for a derivative.

#### Scenario: Cancelling a prompt
- **WHEN** the user dismisses the bucket, object, or derivative prompt
- **THEN** the command ends silently

#### Scenario: Object has no derivatives yet
- **WHEN** a derivative-level command is run from the Command Palette on an object with no viewable derivative
- **THEN** the warning "No derivatives yet for <urn>" is shown and the command ends

### Requirement: List viewables

`aps.md.listViewables` SHALL show the object's model views (viewables) as formatted JSON in a read-only editor.

#### Scenario: Viewables exist
- **WHEN** the command runs on a translated object
- **THEN** a progress notification "Retrieving list of viewables" is shown and the JSON opens in a read-only document identified by the object's URN

#### Scenario: Re-running
- **WHEN** the command is run again for the same object while its document is open
- **THEN** the existing document is reused and updated rather than a new tab opened

#### Scenario: Retrieval fails
- **WHEN** the service request fails (for example the object was never translated)
- **THEN** the error "Could not retrieve viewables" is shown with the details

### Requirement: View object manifest

`aps.md.viewObjectManifest` SHALL show the object's manifest as formatted JSON in a read-only editor.

#### Scenario: Manifest exists
- **WHEN** the command runs
- **THEN** a progress notification "Retrieving manifest for <urn>" is shown and the manifest opens in a read-only document identified by the URN

#### Scenario: Retrieval fails
- **WHEN** the manifest cannot be fetched
- **THEN** the error "Could not access object manifest" is shown with the details

### Requirement: View derivative tree and properties

`aps.md.viewDerivativeTree` and `aps.md.viewDerivativeProps` SHALL show the object tree or all properties of the derivative's first viewable (a child with role `graphics` or `pdf-page`) as formatted JSON in a read-only editor, identified by URN and viewable GUID.

#### Scenario: Data retrieved
- **WHEN** the command runs on a derivative
- **THEN** progress "Retrieving viewable tree" or "Retrieving viewable properties" is shown and the result opens in a read-only document

#### Scenario: Response too large
- **WHEN** the service reports that the content is too large (HTTP 413)
- **THEN** a message offers Force Download or Cancel

#### Scenario: Forced download accepted
- **WHEN** the user chooses Force Download
- **THEN** the data is fetched with the size limit bypassed (progress "Downloading viewable tree" or "Downloading viewable properties"), a save dialog defaults to `tree.json` or `properties.json`, the file is written, and "Tree downloaded to <path>." or "Properties downloaded to <path>." is shown with an Open Folder action

#### Scenario: Save dialog dismissed
- **WHEN** the user dismisses the save dialog after a forced download
- **THEN** nothing is written and no message is shown

#### Scenario: Force download declined
- **WHEN** the user chooses Cancel or dismisses the message
- **THEN** no download or document is produced

#### Scenario: Other failure
- **WHEN** retrieval fails for another reason
- **THEN** the error "Could not access derivative tree" or "Could not access derivative properties" is shown with the details

### Requirement: View thumbnails

`aps.md.viewObjectThumbnail` SHALL open a webview panel titled `Thumbnails: <key>` showing the object's 100x100, 200x200, and 400x400 pixel PNG thumbnails, each with a download button. For a Hubs version the key is its item ID.

#### Scenario: Thumbnails available
- **WHEN** the object has a manifest and thumbnails
- **THEN** a progress notification "Downloading thumbnails: <key>" is shown and the panel displays the three images in order of size

#### Scenario: Downloading a thumbnail
- **WHEN** the user presses a download button
- **THEN** a save dialog defaults to `<key>.100x100.png`, `<key>.200x200.png`, or `<key>.400x400.png` respectively; after saving, "Thumbnail downloaded: <path>" is shown

#### Scenario: Save dialog dismissed
- **WHEN** the user dismisses the save dialog
- **THEN** nothing is written

#### Scenario: Object not translated
- **WHEN** the manifest or thumbnails cannot be fetched
- **THEN** a message explains the object must be translated first and offers Translate, which starts the default SVF2 translation (see `model-derivative-translation`), and dismissing the message does nothing
