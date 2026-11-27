# Model derivative translation

## Purpose

Start, remove, and retrieve Model Derivative translations of OSS objects (app, 2-legged) and Hubs versions (user, 3-legged). Covers the default SVF2 translation (`aps.md.translateObject`), the custom translation panel (`aps.md.translateObjectCustom`), manifest deletion (`aps.md.deleteObjectManifest`), downloading non-viewable derivatives (`aps.md.downloadDerivativeCustom`), and copying an object's URN (`aps.md.copyObjectUrn`).

Out of scope: inspecting results (see `model-derivative-inspection`), the viewer (see `viewer-preview`), and the derivative status nodes shown under objects in the tree (see `object-storage`).

## Requirements

### Requirement: Command entry points and target selection

The translation commands SHALL accept a tree node as their target: an OSS object in `apsDataManagementView` (`viewItem == object`) or a version in `apsHubsView` (`viewItem == version`). `aps.md.copyObjectUrn`, `aps.md.translateObject`, and `aps.md.translateObjectCustom` SHALL be offered in the Model Derivative submenu of those nodes. `aps.md.deleteObjectManifest` SHALL be offered on OSS objects only, in the Data Management view. When a command is run without a target (for example from the Command Palette), it SHALL prompt for a bucket and then an object in that bucket.

#### Scenario: Run from the Command Palette
- **WHEN** the user runs any of these commands without a tree node
- **THEN** a bucket is prompted for, then an object in that bucket, and the command continues with that object

#### Scenario: Cancelling the bucket or object prompt
- **WHEN** the user dismisses the bucket prompt or the object prompt
- **THEN** the command ends silently and nothing is changed

#### Scenario: Hubs version target
- **WHEN** the command is run on a version in `apsHubsView`
- **THEN** the translation is performed in the signed-in user's context rather than the application's

### Requirement: Default translation

`aps.md.translateObject` SHALL start a translation of the target to SVF2 including both 2D and 3D views, forcing re-translation if derivatives already exist. Before starting, it SHALL check that the source file's extension is convertible to SVF2 according to the service's list of supported formats.

#### Scenario: Translation starts
- **WHEN** the source format supports SVF2
- **THEN** a progress notification "Starting translation..." is shown, followed by the message "Translation started. Expand the object in the tree to see details.", and the tree is refreshed

#### Scenario: Source format not convertible to SVF2
- **WHEN** the service does not list SVF2 among the output formats for the file's extension
- **THEN** the error "The conversion to SVF2 is not supported for this file by Model derivative service" is shown, no job is started, and the tree is refreshed

#### Scenario: Translation request fails
- **WHEN** retrieving supported formats or starting the job fails
- **THEN** an error message "Could not translate object" is shown with the failure details, and the tree is refreshed

#### Scenario: Supported formats lookup is reused
- **WHEN** the supported formats have been fetched once successfully
- **THEN** later translation commands reuse them without refetching; a failed fetch is not remembered and is retried on the next command

### Requirement: Custom translation panel

`aps.md.translateObjectCustom` SHALL open a webview panel titled `Custom Translation: <urn>` that lets the user configure and start a translation job. The panel SHALL show the object's URN (read-only), a compressed (ZIP) source option, a root filename field (enabled only when the compressed option is on), an output format dropdown, output-specific and advanced settings, and workflow settings for webhooks (workflow ID and workflow attributes), followed by a start button.

#### Scenario: Source format has no supported translations
- **WHEN** the service lists no output formats for the file's extension
- **THEN** the error "Source file format is not supported by Model derivative service" is shown and no panel opens

#### Scenario: Initial values
- **WHEN** the panel opens
- **THEN** the output format dropdown lists the formats available for the source extension, preselecting SVF2 if available and otherwise the first one; the compressed option is on only if the source extension is `zip`; 2D and 3D views are both enabled

#### Scenario: SVF or SVF2 output options
- **WHEN** the output format is `svf` or `svf2`
- **THEN** 2D and 3D view checkboxes are shown, plus advanced settings that depend on the source extension: `rvt` (2D views, extractor version, generate master views, material mode), `dgn` (requested linkage IDs, as a comma-separated list of numbers), `dwg` and `idw` (2D views), `ifc` (conversion method, building storeys, spaces, opening elements), `nwd` (hidden objects, basic material properties, Autodesk material properties, timeliner properties), `vue` (hierarchy). Other source extensions show no advanced settings

#### Scenario: IFC conversion method default
- **WHEN** the source is `ifc` and the output is SVF or SVF2
- **THEN** the conversion method defaults to `v4` and is sent explicitly in the job, and switching the output format between SVF family and non-SVF formats resets the advanced settings to their defaults

#### Scenario: Other output formats
- **WHEN** the output format is `thumbnail`, `stl`, `obj`, `step`, `iges`, `dwg`, or `ifc`
- **THEN** the panel shows that format's specific settings (thumbnail: width and height; stl: format, export color, export file structure; obj: export file structure, unit, model GUID, object IDs; step: application protocol, tolerance; iges: tolerance, surface type, sheet type, solid type; dwg and ifc: export setting name); any other format (for example `fbx`) shows no extra settings

#### Scenario: Starting the job
- **WHEN** the user presses the start button
- **THEN** a job is submitted with re-translation forced, using only the settings relevant to the selected output format; the root filename is sent only if the compressed option is on; the workflow ID and (JSON-parsed) workflow attributes are sent only if a workflow ID was entered

#### Scenario: Job started
- **WHEN** the job is accepted
- **THEN** the message "Translation started. Expand the object in the tree to see details." is shown, the panel closes, and the tree is refreshed

#### Scenario: Derivatives exist in another region
- **WHEN** the service responds with status 406
- **THEN** the error "Could not translate object, likely because its derivatives exist in a different region. Please, delete the derivatives manually before translating the object again." is shown, the panel closes, and the tree is refreshed

#### Scenario: Other job failure
- **WHEN** submitting the job fails for any other reason (including invalid workflow attributes JSON)
- **THEN** the error "Could not translate object" is shown with the details, the panel closes, and the tree is refreshed

#### Scenario: Closing the panel without starting
- **WHEN** the user closes the panel without pressing start
- **THEN** no job is started

### Requirement: Delete manifest

`aps.md.deleteObjectManifest` SHALL delete the manifest, and therefore all derivatives, of an OSS object after an explicit modal confirmation. It SHALL report success only when a manifest was actually deleted.

#### Scenario: Confirmed deletion
- **WHEN** the user confirms the modal "Are you sure you want to delete manifest for <urn>? This action cannot be undone." with Delete
- **THEN** a progress notification is shown, the manifest is deleted, "Derivatives deleted: <object key>" is shown, and the tree is refreshed

#### Scenario: Declining the confirmation
- **WHEN** the user dismisses the modal or does not choose Delete
- **THEN** nothing is deleted and the tree is not refreshed

#### Scenario: Object has no manifest
- **WHEN** the user confirms the deletion and the object has no manifest because it was never translated
- **THEN** "No derivatives to delete: <object key>" is shown, no translation is offered, "Derivatives deleted" is not shown, and the tree is refreshed

#### Scenario: Deletion request fails
- **WHEN** the delete request fails for any reason other than a missing manifest (for example a network, authorization, or server error)
- **THEN** an error "Could not delete derivatives" is shown with the failure details, "Derivatives deleted" is not shown, and the tree is refreshed

#### Scenario: Unexpected failure
- **WHEN** a failure occurs outside the deletion request (for example while prompting)
- **THEN** an error "Could not delete derivatives" is shown and the tree is refreshed

### Requirement: Download non-viewable derivatives

`aps.md.downloadDerivativeCustom` SHALL download a non-viewable derivative (for example OBJ, STL, STEP, IGES, IFC output) to a folder chosen by the user. It SHALL be offered on non-viewable derivative nodes (`viewItem == non-viewable-derivative`) in `apsDataManagementView` and `apsHubsView`. The derivative nodes themselves are shown by the tree views (see `object-storage`).

#### Scenario: Run from the Command Palette
- **WHEN** the command is run without a node
- **THEN** a bucket and an object are prompted for, then the object's non-viewable derivatives are listed in a quick pick with placeholder "Select derivative"

#### Scenario: Successful download
- **WHEN** the user picks an output folder
- **THEN** a progress notification "Downloading the derivative: <name>" is shown, the file is saved under the derivative's file name in that folder, and "Derivative downloaded successfully" is shown with an Open Folder action that reveals the folder

#### Scenario: Cancelling
- **WHEN** the user dismisses the bucket, object, derivative, or folder prompt
- **THEN** the command ends silently and nothing is downloaded

#### Scenario: Download fails
- **WHEN** the signed download request fails or returns a non-success HTTP status
- **THEN** an error "Could not download the derivative" is shown with the details

### Requirement: Copy object URN

`aps.md.copyObjectUrn` SHALL copy the target's Model Derivative URN to the clipboard. The URN SHALL be the base64 encoding of the object's ID (for an OSS object, its object ID; for a Hubs version, its version ID), without trailing `=` padding and with `/` replaced by `_` and `+` by `-`.

#### Scenario: Copying
- **WHEN** the command runs on an object or version
- **THEN** the URN is written to the clipboard and "Object URN copied to clipboard: <urn>" is shown

#### Scenario: Cancelling the prompts
- **WHEN** the command is run without a node and the user dismisses the bucket or object prompt
- **THEN** nothing is copied

#### Scenario: Failure
- **WHEN** the URN cannot be obtained
- **THEN** an error "Could not obtain object URN" is shown

#### Scenario: Distinguishing Hubs from OSS URNs
- **WHEN** a URN contains an underscore
- **THEN** it is treated as a Hubs resource and handled in the user's context; URNs without an underscore are treated as OSS objects handled in the application's context
