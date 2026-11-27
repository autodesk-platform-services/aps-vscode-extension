# Design automation

## Purpose

Browse and manage Design Automation app bundles and activities owned by (or shared with) the active environment's application (2-legged auth, `code:all` scope), and run work items against activities. Resources are shown in the app Automation view (`apsDesignAutomationView`, titled "Automation (app)"), with commands for creating, inspecting, updating, aliasing, and deleting them, and two webview forms for editing activities and creating work items. The Design Automation region or endpoint can be customized per environment.

Out of scope: environment management and switching in general (see `environment-management`), and user (3-legged) views.

## Requirements

### Requirement: View structure

The view SHALL show four root nodes, in this order: "Owned App Bundles", "Shared App Bundles", "Owned Activities", and "Shared Activities". Each owned app bundle and each owned activity SHALL expand into an "Aliases" node and a "Versions" node. Shared app bundles, shared activities, app bundle versions, activity versions, app bundle aliases, and activity aliases SHALL be leaves. Alias nodes SHALL show the alias name followed by the aliased version as `[v<version>]`; version nodes SHALL show the version number.

#### Scenario: Expanding the view
- **WHEN** the view is shown
- **THEN** the four root nodes are listed and nothing is fetched until a root node is expanded

#### Scenario: Expanding an owned resource
- **WHEN** the user expands an owned app bundle or an owned activity
- **THEN** "Aliases" and "Versions" nodes are shown, and each fetches its children only when expanded

#### Scenario: Refreshing
- **WHEN** the user runs `aps.da.refreshDesignAutomationTree` (toolbar button of the view)
- **THEN** the tree is reloaded from the service

#### Scenario: Empty results
- **WHEN** a node has no children (for example, no owned activities or no aliases)
- **THEN** it expands to nothing and no error is shown

### Requirement: Owned and shared split

The extension SHALL determine the application's nickname once per environment session and use it to classify resources. App bundles and activities whose full ID has the application's nickname as owner SHALL be listed under the "Owned" nodes by their unqualified ID, de-duplicated across aliases and versions. All others SHALL be listed under the "Shared" nodes by their full ID (`<owner>.<id>+<alias>`). All pages of the API list SHALL be fetched, not only the first.

#### Scenario: Owned resources
- **WHEN** the API returns `myapp.Bundle+prod` and `myapp.Bundle+dev`
- **THEN** "Owned App Bundles" lists `Bundle` once

#### Scenario: Shared resources
- **WHEN** the API returns `other.Tool+prod`
- **THEN** "Shared App Bundles" lists `other.Tool+prod`

#### Scenario: Loading fails
- **WHEN** a request to list resources, aliases, or versions fails
- **THEN** the node cannot be expanded successfully and no resources are listed under it

### Requirement: Alias and version listings

The "Aliases" nodes SHALL list an app bundle's or activity's aliases excluding the `$LATEST` pseudo-alias. The "Versions" nodes SHALL list all version numbers.

#### Scenario: Latest alias hidden
- **WHEN** an activity has aliases `$LATEST` and `prod`
- **THEN** only `prod [v<version>]` is listed

### Requirement: Region and endpoint per environment

Each entry of `autodesk.forge.environments` MAY set `designAutomationRegion` and `designAutomationEndpoint`. All Design Automation requests SHALL go to `<host>/da/<designAutomationRegion>/v3`, where `host` is the environment's `host` (default `https://developer.api.autodesk.com`) and `designAutomationRegion` defaults to `us-east`. When `designAutomationEndpoint` is set, it SHALL be used as the base URL instead, overriding both `host` and `designAutomationRegion` for Design Automation calls only; authentication and other services SHALL keep using `host`. Trailing slashes SHALL be ignored.

#### Scenario: Default region
- **WHEN** an environment sets neither `designAutomationRegion` nor `designAutomationEndpoint`
- **THEN** requests go to `https://developer.api.autodesk.com/da/us-east/v3`

#### Scenario: Custom region
- **WHEN** an environment sets `designAutomationRegion` to `us-west`
- **THEN** requests go to `<host>/da/us-west/v3`

#### Scenario: Custom endpoint
- **WHEN** an environment sets `designAutomationEndpoint` to a full base URL
- **THEN** requests go to that URL, and `designAutomationRegion` and `host` are ignored for Design Automation

#### Scenario: Switching environments
- **WHEN** the user switches to an environment with different Design Automation settings
- **THEN** subsequent requests, including the owned/shared classification, use that environment's region or endpoint and its application's nickname

### Requirement: Tree-only invocation

Commands that act on a tree node SHALL require one. Invoking such a command without a node (for example, from the Command Palette) SHALL fail with the message "This command can only be triggered from the tree view." Commands that can run without a node are `aps.da.refreshDesignAutomationTree`, `aps.da.createAppBundle`, `aps.da.createActivity`, and `aps.da.viewAppBundleDetails`. The alias details commands `aps.da.viewAppBundleAliasDetails` and `aps.da.viewActivityAliasDetails` require a node and are hidden from the Command Palette.

#### Scenario: Command Palette invocation of a node command
- **WHEN** the user runs `aps.da.deleteActivity` from the Command Palette
- **THEN** the error "This command can only be triggered from the tree view." is shown and nothing is deleted

### Requirement: Create and update app bundle

`aps.da.createAppBundle` (offered on the "Owned App Bundles" node) SHALL guide the user through a multi-step flow titled "Upload app bundle": enter the app bundle name (required, non-empty), choose a local zip file ("Upload zip" button), select an engine, and enter a description (may be empty). `aps.da.updateAppBundle` (offered on an owned app bundle) SHALL run the same flow without the name step and create a new version of that app bundle. The engine picker SHALL list engines available in the region, with the most recently used engine first. After the details are accepted, the archive SHALL be uploaded with a progress notification "Uploading app bundle: <path>", followed by the message "App bundle uploaded: <path>", and the tree SHALL refresh. Steps after the first SHALL offer a Back button.

#### Scenario: Creating an app bundle
- **WHEN** the user completes all steps of `aps.da.createAppBundle`
- **THEN** the app bundle is created, the archive is uploaded, "App bundle uploaded: <path>" is shown, and the tree is refreshed

#### Scenario: Updating an app bundle
- **WHEN** the user completes the flow of `aps.da.updateAppBundle` on an owned app bundle
- **THEN** a new version is created with the chosen engine and description, and the archive is uploaded to it

#### Scenario: Cancelling
- **WHEN** the user dismisses any step or the file dialog
- **THEN** nothing is created or uploaded and no error is shown

#### Scenario: Empty name
- **WHEN** the user submits an empty app bundle name
- **THEN** the input stays open

#### Scenario: Upload fails
- **WHEN** creating the app bundle or uploading the archive fails
- **THEN** the error "Could not upload app bundle" is shown with the failure message

### Requirement: View app bundle details

`aps.da.viewAppBundleDetails` SHALL open the app bundle's details as read-only JSON, for a shared app bundle or an app bundle alias node. When run without a node, it SHALL prompt for an app bundle via a quick pick ("Select app bundle") listing app bundle full IDs without `$LATEST` entries, with the most recently used first. `aps.da.viewAppBundleAliasDetails` (offered on an app bundle alias; hidden from the Command Palette) SHALL open the details of a single alias as read-only JSON. `aps.da.viewAppBundleVersionDetails` (offered on an app bundle version) SHALL open the details of that version.

#### Scenario: Viewing from the tree
- **WHEN** the user runs `aps.da.viewAppBundleDetails` on an app bundle alias or shared app bundle
- **THEN** the details are fetched with a progress notification and shown in a read-only JSON editor

#### Scenario: Alias details are not offered in the Command Palette
- **WHEN** the user opens the Command Palette
- **THEN** neither `aps.da.viewAppBundleAliasDetails` nor `aps.da.viewActivityAliasDetails` is listed

#### Scenario: Cancelling the picker
- **WHEN** the user dismisses the app bundle picker
- **THEN** nothing is shown and no error is reported

#### Scenario: Access fails
- **WHEN** fetching details fails
- **THEN** the error "Could not access app bundle" (or "Could not access app bundle alias") is shown

### Requirement: Delete app bundle, alias, and version

`aps.da.deleteAppBundle` (owned app bundle), `aps.da.deleteAppBundleAlias` (app bundle alias), and `aps.da.deleteAppBundleVersion` (app bundle version) SHALL each ask for confirmation in a modal warning ("Are you sure you want to delete app bundle: <id>? This action cannot be undone.", and equivalents for alias `<id>/<alias>` and version `<id>/<version>`) with a "Delete" button before deleting. On success they SHALL show "App bundle removed", "App bundle alias removed", or "App bundle version removed" respectively, and the tree SHALL refresh.

#### Scenario: Confirmed deletion
- **WHEN** the user confirms by choosing "Delete"
- **THEN** the resource is deleted with a progress notification and a removal message is shown

#### Scenario: Declined deletion
- **WHEN** the user dismisses or cancels the confirmation
- **THEN** nothing is deleted and no message is shown

#### Scenario: Deletion fails
- **WHEN** the API rejects the deletion
- **THEN** the error "Could not remove app bundle" (or "... app bundle alias", "... app bundle version") is shown

### Requirement: App bundle aliases

`aps.da.createAppBundleAlias` (offered on an "Aliases" node of an app bundle) SHALL prompt for the alias name ("Enter alias name"), then a version ("Select app bundle version") from the bundle's versions, then an optional receiver ID ("Enter receiver ID (optional)"), and create the alias; on success "App bundle alias created" is shown and the tree refreshes. `aps.da.updateAppBundleAlias` (offered on an app bundle alias) SHALL prompt for the version and the optional receiver ID and repoint the alias; on success "App bundle alias updated" is shown and the tree refreshes. An empty receiver SHALL leave the receiver unset.

#### Scenario: Creating an alias
- **WHEN** the user enters a name, picks version 3, and leaves the receiver empty
- **THEN** an alias pointing to version 3 without a receiver is created

#### Scenario: Cancelling name or version
- **WHEN** the user dismisses the alias name input or the version picker
- **THEN** no alias is created or changed and no error is shown

#### Scenario: Updating an alias
- **WHEN** the user picks a different version for an existing alias
- **THEN** the alias is repointed and "App bundle alias updated" is shown

#### Scenario: Alias operation fails
- **WHEN** creating or updating an alias fails
- **THEN** the error "Could not create app bundle alias" or "Could not update app bundle alias" is shown

### Requirement: View activity details

`aps.da.viewActivityDetails` (shared activity, activity alias), `aps.da.viewActivityVersionDetails` (activity version), and `aps.da.viewActivityAliasDetails` (activity alias; hidden from the Command Palette) SHALL open the corresponding details as read-only JSON after a progress notification "Getting activity details: <id>". All three SHALL require a tree node.

#### Scenario: Viewing activity details
- **WHEN** the user runs `aps.da.viewActivityDetails` on an activity alias
- **THEN** the details of the activity as seen through that alias are shown in a read-only JSON editor

#### Scenario: Access fails
- **WHEN** fetching fails
- **THEN** the error "Could not access activity" (or "Could not access activity alias") is shown

### Requirement: Create and update activity

`aps.da.createActivity` (offered on the "Owned Activities" node) SHALL open an "Create Activity" webview form. `aps.da.updateActivity` (offered on an activity alias, in its manage submenu, and on an activity version) SHALL open an "Update Activity: <id>" form prefilled from the activity's current details; updating creates a new version of the activity. Before the form opens, the extension SHALL load the available engines (sorted alphabetically) and available app bundles (excluding `$LATEST` entries) with progress notifications. The form SHALL let the user edit ID, description, engine, a list of command lines, a list of parameters (name, description, verb GET/PUT/POST/PATCH/READ, local name, required, zip, on demand), string settings (name, value, "is environment variable"), URL settings (name, URL, verb GET/PUT/POST/PATCH), and a list of app bundles, each with add and remove buttons. Adding a command line SHALL prefill a preset for AutoCAD, 3ds Max, Revit, and Inventor engines (based on the first GET parameter and first app bundle), and an empty line for other engines. On submit, the activity SHALL be created or updated with a progress notification; on success the panel SHALL close, "Activity created: <id> (version <n>)" or "Activity updated: <id> (version <n>)" SHALL be shown, and the tree SHALL refresh.

#### Scenario: Creating an activity
- **WHEN** the user fills in the form and presses "Create"
- **THEN** the activity is created, the panel closes, and "Activity created: <id> (version <n>)" is shown

#### Scenario: Updating from a version
- **WHEN** the user runs `aps.da.updateActivity` on an activity version
- **THEN** the form is prefilled with that version's details, and "Update" creates a new version

#### Scenario: Command line preset
- **WHEN** the engine is Revit and the user presses "Add Command"
- **THEN** a new command line is added that invokes the Revit core console with the first GET parameter as input and the first app bundle as add-in

#### Scenario: Submit fails
- **WHEN** the API rejects the creation or update
- **THEN** the error "Could not create activity" or "Could not update activity" is shown and the panel stays open

#### Scenario: Preparation fails
- **WHEN** loading engines, app bundles, or the original activity fails
- **THEN** the same error is shown and no panel opens

#### Scenario: Closing the panel
- **WHEN** the user closes the form without submitting
- **THEN** nothing is changed

### Requirement: Delete activity, alias, and version

`aps.da.deleteActivity` (owned activity), `aps.da.deleteActivityAlias` (activity alias), and `aps.da.deleteActivityVersion` (activity version) SHALL follow the same confirmation, progress, success, and error pattern as the app bundle deletions: a modal warning ("Are you sure you want to delete activity: <id>? This action cannot be undone.", or the alias or version equivalent) with a "Delete" button; on success "Activity removed", "Activity alias removed", or "Activity version removed"; the tree SHALL refresh. Failures SHALL show "Could not remove activity", "Could not remove activity alias", or "Could not remove activity version".

#### Scenario: Confirmed deletion
- **WHEN** the user confirms "Delete" for an owned activity
- **THEN** the activity is removed and "Activity removed" is shown

#### Scenario: Declined deletion
- **WHEN** the user dismisses the confirmation
- **THEN** nothing is deleted

### Requirement: Activity aliases

`aps.da.createActivityAlias` (offered on an "Aliases" node of an activity) and `aps.da.updateActivityAlias` (offered on an activity alias) SHALL behave like their app bundle counterparts, with the version picker titled "Select activity version" and the messages "Activity alias created" and "Activity alias updated"; the tree refreshes after each succeeds. Failures SHALL show "Could not create activity alias" or "Could not update activity alias".

#### Scenario: Creating an activity alias
- **WHEN** the user enters a name, picks a version, and an optional receiver
- **THEN** the alias is created and "Activity alias created" is shown

#### Scenario: Cancelling
- **WHEN** the user dismisses the name input or the version picker
- **THEN** no alias is created or changed

### Requirement: Create work item

`aps.da.createWorkItem` (offered on a shared activity and, in the manage submenu, on an activity alias) SHALL load the activity's details with a progress notification and open a "Create Work Item: <activity id>" webview form listing one row per activity parameter with: name, value (URL), verb (GET/PUT/POST/PATCH/READ, defaulting to the parameter's verb), optional, local name, path in zip, and headers (entered as `HeaderA:ValueA;HeaderB:ValueB`; entries are split on the first `:` so values may contain colons, and empty entries or entries without a name or `:` are ignored). On "Create", the work item SHALL be submitted and the extension SHALL monitor it in a cancellable notification "Processing workitem", polling every 5 seconds and showing the current status, until it is no longer pending or in progress. The form SHALL stay open so the user can submit another work item.

#### Scenario: Successful work item
- **WHEN** the work item finishes with status `success`
- **THEN** the message "Workitem succeeded" is shown with a "View Report" button

#### Scenario: Failed work item
- **WHEN** the work item finishes with any other status
- **THEN** the error "Workitem failed" is shown with a "View Report" button

#### Scenario: Viewing the report
- **WHEN** the user presses "View Report"
- **THEN** the work item's plain-text report is fetched and opened in a read-only text editor

#### Scenario: Cancelling monitoring
- **WHEN** the user cancels the progress notification
- **THEN** monitoring stops and "Workitem monitoring cancelled" is shown

#### Scenario: Submission fails
- **WHEN** creating or polling the work item fails for a reason other than cancellation
- **THEN** the error "Could not start workitem" is shown

#### Scenario: Activity cannot be loaded
- **WHEN** fetching the activity fails
- **THEN** the error "Could not create workitem" is shown and no form opens
