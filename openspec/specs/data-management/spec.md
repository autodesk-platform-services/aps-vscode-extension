# Data management

## Purpose

Browse the Data Management hierarchy that the signed-in user can access (3-legged auth) in the user Hubs view (`apsHubsView`): hubs, projects, folders, items, and item versions. Versions expose their Model Derivative derivatives, and each node type offers a command to copy its ID.

Out of scope: OSS buckets and objects in the app Data Management view (see `object-storage`), Model Derivative translation, inspection, and preview commands available on versions and derivatives (see `model-derivative-translation` and `model-derivative-inspection`), the Issues view (see `issues`), and sign-in/sign-out.

## Requirements

### Requirement: Signed-in state

The Hubs view SHALL show data only while a user session exists. When no user is signed in, the view SHALL be empty and SHALL show a welcome message, "Data Management hubs require a user context.", with a "Sign in to APS" link that runs `aps.auth.login`. When signed in, `aps.auth.logout` SHALL be available in the view's title bar.

#### Scenario: Not signed in
- **WHEN** the Hubs view is shown and there is no user session
- **THEN** no hubs are requested, the view is empty, and the sign-in welcome message is shown

#### Scenario: Signed in
- **WHEN** the Hubs view is shown with a user session
- **THEN** the hubs accessible to the user are listed at the root

### Requirement: Hierarchy

The view SHALL present, from the root down: hubs, then the projects of each hub, then the top-level folders of each project, then the contents (folders and items) of each folder, then the versions of each item, then the derivatives of each version. All nodes except derivatives and hints SHALL be expandable. Each node's tooltip SHALL show its kind, ID, and name.

#### Scenario: Expanding a hub
- **WHEN** the user expands a hub
- **THEN** the hub's projects are listed

#### Scenario: Expanding a project
- **WHEN** the user expands a project
- **THEN** the project's top-level folders are listed

#### Scenario: Expanding a folder
- **WHEN** the user expands a folder
- **THEN** its sub-folders and items are listed, in the order returned by the service

#### Scenario: Expanding an item
- **WHEN** the user expands an item
- **THEN** its versions are listed

#### Scenario: Empty parent
- **WHEN** a hub, project, folder, or item has no children
- **THEN** nothing is shown beneath it

### Requirement: Node names

A node's label SHALL be the first available of the following, falling back to `<no name>` when none is available. Hubs and projects SHALL use their `name`. Folders SHALL prefer `displayName` over `name`. Items SHALL use `displayName`. Versions SHALL use their last-modified time, or their creation time when there is no last-modified time.

When a folder's label comes from `displayName` and differs from its `name`, the folder's tooltip SHALL list both "Display Name" and "Name".

Top-level folders flagged as hidden SHALL be prefixed with `(hidden) `.

#### Scenario: Display name present
- **WHEN** a folder has both `displayName` and `name`
- **THEN** the label is the display name, and the tooltip shows the display name and the raw name

#### Scenario: Display name absent
- **WHEN** a folder has no `displayName`
- **THEN** the label is its `name`, and the tooltip shows the name only

#### Scenario: Hidden top-level folder
- **WHEN** a top-level folder is hidden
- **THEN** its label starts with `(hidden) `

#### Scenario: No usable name
- **WHEN** a hub, project, folder, or item has no name
- **THEN** its label is `<no name>`

### Requirement: Pagination

Projects, folder contents, and item versions SHALL be fetched one page at a time. The page size SHALL come from `autodesk.forge.data.hubsPageSize` (clamped to 1–200; default 32). When more pages remain for a parent, a trailing "Load more…" node SHALL follow the loaded items; selecting it (`aps.dm.loadMore`) SHALL fetch the next page and append it to that parent only. Hubs and top-level folders SHALL NOT be paginated.

#### Scenario: More pages available
- **WHEN** a page is returned with a link to a next page
- **THEN** a "Load more…" node follows the loaded items

#### Scenario: Loading the next page
- **WHEN** the user selects "Load more…" under a parent
- **THEN** the next page is appended to that parent's children and no other node is refreshed

#### Scenario: Last page reached
- **WHEN** a page is returned without a next-page link
- **THEN** no "Load more…" node is shown

#### Scenario: Loading more fails
- **WHEN** fetching the next page fails
- **THEN** an error message "Could not load more items" is shown and the already loaded items remain

#### Scenario: Command availability
- **WHEN** the user opens the Command Palette
- **THEN** `aps.dm.loadMore` is not listed, as it is only invoked from the "Load more…" node

#### Scenario: Refresh discards loaded pages
- **WHEN** the whole view is refreshed, for example after a Model Derivative translation is started from either the app or user view
- **THEN** all loaded pages and continuation state are discarded and each parent is fetched again from its first page

### Requirement: Error hints

When loading any level fails, the view SHALL show a single hint node in place of that level's children, with an explanatory tooltip. The failure SHALL NOT raise an error notification, and sibling nodes SHALL be unaffected.

#### Scenario: Loading fails
- **WHEN** loading hubs, projects, top-level folders, folder contents, item versions, or derivatives fails
- **THEN** a hint reads, respectively, "Could not retrieve hubs.", "Could not retrieve projects.", "Could not retrieve top-level folders.", "Could not retrieve folder contents.", "Could not retrieve item versions.", or "Could not retrieve derivatives."

### Requirement: Version derivatives

Expanding a version SHALL show the Model Derivative status of that version.

#### Scenario: Translation succeeded
- **WHEN** the version's manifest status is `success`
- **THEN** its viewable derivatives are listed; each shows its name, with a tooltip showing name, format, and role

#### Scenario: Translation failed
- **WHEN** the manifest status is `failed`
- **THEN** a "Translation failed (hover for more info)" hint is shown, with the failure code and message in its tooltip, or a generic tooltip when there are no messages

#### Scenario: Translation in progress
- **WHEN** the manifest is neither `success` nor `failed`
- **THEN** a "Translation in progress (<progress>)" hint is shown and that version is refreshed automatically after one second, repeating until translation finishes

#### Scenario: No manifest
- **WHEN** the manifest cannot be retrieved
- **THEN** a "No derivatives yet (hover for more info)" hint is shown, and its tooltip suggests triggering a new translation job

#### Scenario: Model Derivative commands
- **WHEN** the user opens the context menu of a version or derivative
- **THEN** the Model Derivative submenu, `aps.md.viewObjectThumbnail`, and `aps.md.viewObjectManifest` are offered on versions, and `aps.md.previewDerivative` on derivatives (plus `aps.md.downloadDerivativeCustom` on non-viewable derivatives), with behavior as specified in `model-derivative-translation` and `model-derivative-inspection`

### Requirement: Copy IDs

The user SHALL be able to copy the ID of a node to the clipboard from its context menu. After copying, an information message "<Kind> ID copied to clipboard: <id>" SHALL be shown. These commands SHALL only be available from the Hubs view on the matching node kind.

| Command | Node |
| --- | --- |
| `aps.dm.copyHubID` | hub |
| `aps.dm.copyProjectID` | project |
| `aps.dm.copyFolderID` | folder |
| `aps.dm.copyItemID` | item |
| `aps.dm.copyVersionID` | version |

#### Scenario: Copying an ID
- **WHEN** the user runs a copy command on a node
- **THEN** that node's ID is on the clipboard and the confirmation message is shown

#### Scenario: Triggered without a node
- **WHEN** a copy command is run from the Command Palette instead of the tree view
- **THEN** the error "This command can only be triggered from the tree view." is raised

#### Scenario: Context menu scope
- **WHEN** the user opens the context menu of a hub, project, folder, item, or version in the Hubs view
- **THEN** only the copy command for that node kind is offered
