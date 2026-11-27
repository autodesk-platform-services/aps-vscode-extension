# Viewer preview

## Purpose

Preview a translated derivative with the APS Viewer inside a VS Code webview panel, opened by `aps.md.previewDerivative`. The viewer is configurable through the `autodesk.forge.viewer.extensions`, `autodesk.forge.viewer.scripts`, `autodesk.forge.viewer.env`, and `autodesk.forge.viewer.api` settings, and panels survive window reloads.

Out of scope: inspecting derivatives as JSON or thumbnails (see `model-derivative-inspection`) and starting translations (see `model-derivative-translation`).

## Requirements

### Requirement: Opening a preview

`aps.md.previewDerivative` SHALL open a viewer panel titled `Preview: <derivative name>` for a derivative. The command SHALL be offered on derivative nodes (`viewItem == derivative`). Run without a target, it SHALL prompt for a bucket, an object, and then a derivative from a quick pick with placeholder "Select derivative".

#### Scenario: Opening from a derivative node
- **WHEN** the user runs the command on a derivative node
- **THEN** a progress notification "Retrieving viewer access token" is shown and a viewer panel opens, loading that derivative's viewable

#### Scenario: Cancelling prompts
- **WHEN** the user dismisses the bucket, object, or derivative prompt
- **THEN** no panel opens

#### Scenario: Object not translated
- **WHEN** the command is run from the Command Palette on an object with no viewable derivative
- **THEN** the warning "No derivatives yet for <urn>" is shown and no panel opens

#### Scenario: Token or setup failure
- **WHEN** the access token cannot be obtained or another step fails
- **THEN** the error "Could not access object" is shown with the details and no panel opens

### Requirement: Access token context

The viewer SHALL be given an access token matched to the derivative's source. OSS derivatives SHALL use an application (2-legged) token with `viewables:read` scope; derivatives of Hubs versions (URN containing an underscore) SHALL use the signed-in user's token.

#### Scenario: OSS derivative
- **WHEN** a derivative of an OSS object is previewed
- **THEN** the viewer is authorized with the application token

#### Scenario: Hubs derivative
- **WHEN** a derivative of a Hubs version is previewed
- **THEN** the viewer is authorized with the user's token

### Requirement: Viewer environment and API selection

The viewer SHALL use the Model Derivative environment from `autodesk.forge.viewer.env` and the API from `autodesk.forge.viewer.api` when set. When a setting is empty, the extension SHALL choose a value by the derivative's output format: for SVF2, env `AutodeskProduction2` and API `streamingV2`; otherwise env `AutodeskProduction` and API `derivativeV2`. For an environment whose region is `EMEA`, the default API SHALL get the suffix `_EU`.

#### Scenario: Defaults for SVF
- **WHEN** neither setting is set and the derivative is SVF
- **THEN** the viewer starts with env `AutodeskProduction` and API `derivativeV2`

#### Scenario: Defaults for SVF2 in EMEA
- **WHEN** neither setting is set, the derivative is SVF2, and the active environment's region is `EMEA`
- **THEN** the viewer starts with env `AutodeskProduction2` and API `streamingV2_EU`

#### Scenario: Explicit override
- **WHEN** `autodesk.forge.viewer.env` or `autodesk.forge.viewer.api` is set
- **THEN** that value is used as-is, with no region suffix added

### Requirement: Viewer extensions

The viewer SHALL be configured with the extensions listed in `autodesk.forge.viewer.extensions` (an array of extension IDs; default none).

#### Scenario: Extensions configured
- **WHEN** the setting lists extension IDs and a preview opens
- **THEN** the viewer is created with those extensions

#### Scenario: Setting changed
- **WHEN** any `autodesk.forge.viewer.*` setting changes
- **THEN** panels opened afterwards use the new values; panels already open are not changed

### Requirement: Custom viewer scripts

`autodesk.forge.viewer.scripts` (an array; default none) SHALL list additional JavaScript files loaded into the viewer panel after the viewer library and before it starts, for example to register custom extensions. Each entry SHALL be an `https://` URL, an absolute file path, or a path relative to the first workspace folder.

#### Scenario: Valid entries
- **WHEN** the setting contains `https://` URLs and existing local files
- **THEN** each is loaded in order (local files first, then remote URLs) and the panel is allowed to load them, including the origins of remote scripts and the folders of local scripts

#### Scenario: Unsupported entries
- **WHEN** an entry uses another scheme (for example `http://`), is empty, or is a relative path with no workspace folder open
- **THEN** it is ignored and a warning is written to the extension log

#### Scenario: Missing local file
- **WHEN** a local script file does not exist
- **THEN** it is skipped, a warning is logged, and the message "Viewer script not found, skipping: <paths>" is shown; the preview still opens

### Requirement: Viewer errors

The panel SHALL report document load failures to the extension.

#### Scenario: Viewable fails to load
- **WHEN** the viewer fails to load the document
- **THEN** the error "Could not load viewable" is shown with the viewer's error details

### Requirement: Panel restoration

Open viewer panels SHALL be restored after VS Code reloads, using only non-secret saved state: environment identity (title, client ID, host, region), URN, viewable GUID, viewer API and env, and extension list. The access token SHALL NOT be saved; a fresh token SHALL be obtained on restore, using the saved environment (even if it is not the currently active one) and, for Hubs derivatives, that environment's stored user session.

#### Scenario: Successful restore
- **WHEN** VS Code restores a viewer panel with valid saved state
- **THEN** the same panel is reused with its title, a fresh token is requested, the viewer loads the saved viewable, and the currently configured viewer scripts and extension list from the saved state are applied

#### Scenario: Environment no longer configured
- **WHEN** no configured environment matches the saved title, client ID, host, and region
- **THEN** the panel shows "Could not restore the viewer. Please reopen it from the tree view." and an error "Could not restore viewer" is shown

#### Scenario: Invalid saved state
- **WHEN** the saved state is missing or malformed (wrong version, missing URN, non-string fields)
- **THEN** no token is requested, the same recovery text is shown in the panel, and the error "Could not restore viewer" is shown

#### Scenario: Token retrieval fails
- **WHEN** getting a fresh token fails
- **THEN** the panel shows the recovery text and the error "Could not restore viewer" is shown

#### Scenario: Panel stays alive while hidden
- **WHEN** a viewer panel is moved to a background tab
- **THEN** its viewer state is retained and not reloaded
