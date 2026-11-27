# Webhooks

## Purpose

Browse, create, inspect, update, and delete APS webhooks. Webhooks are shown in two views: the app view `apsWebhooksView` ("Webhooks (app)"), which manages hooks owned by the application (2-legged auth), and the user view `apsWebhooksUserView` ("Webhooks (user)"), which manages hooks owned by the signed-in user (3-legged auth). Both views share the same tree layout, commands, and webview form, and differ only in which identity performs the API calls.

Out of scope: how a user session is established (see `authentication`) and the language model tool that lists webhook systems and events.

## Requirements

### Requirement: Webhook views

The extension SHALL contribute two Webhooks views: `apsWebhooksView` and `apsWebhooksUserView`. Hooks listed, created, updated, viewed, and deleted from a view SHALL use the identity of that view (app or user). Calls SHALL be made in the region of the active environment when it has one, and otherwise use the service default.

#### Scenario: App view uses application identity
- **WHEN** the user expands an event in `apsWebhooksView`
- **THEN** the hooks owned by the application are listed

#### Scenario: User view uses signed-in identity
- **WHEN** the user expands an event in `apsWebhooksUserView` while signed in
- **THEN** the hooks owned by the signed-in user are listed

#### Scenario: User view without a session
- **WHEN** no user session is active
- **THEN** `apsWebhooksUserView` shows no nodes and displays the welcome message "User-owned webhooks require a user context." with a "Sign in to APS" link (`aps.auth.login`)

### Requirement: Tree structure and event catalog

Each view SHALL show a three-level tree: webhook systems, then the events of each system, then the webhooks registered for each event. Systems and events SHALL come from a built-in catalog and SHALL NOT require a network call. The catalog SHALL include these systems: Data Management (`data`), Model Derivative (`derivative`), Revit Cloud Worksharing (`adsk.c4r`), Fusion Lifecycle (`adsk.flc.production`), Cost Management (`autodesk.construction.cost`), BuildingConnected (`autodesk.construction.bc`), Forma Issues (`autodesk.construction.issues`), Forma Reviews (`autodesk.construction.reviews`), and Autodesk Tandem (`adsk.tandem`). Each event in the catalog SHALL declare the scope keys it supports (for example `folder`, `project`, `workspace`, `companyId`, `account`, `modelUrn`, `twinUrn`, `workflow`, `workflow.transition`).

#### Scenario: Systems at the root
- **WHEN** a view is first shown (and, for the user view, a session is active)
- **THEN** the catalog systems are listed in catalog order, each collapsed, with a tooltip showing "Webhook System", its ID, and its name

#### Scenario: Events under a system
- **WHEN** the user expands a system
- **THEN** its catalog events are listed in catalog order, labeled by event ID (for example `dm.version.added`), with a tooltip showing "Webhook Event", the event, and the name

#### Scenario: Webhooks under an event
- **WHEN** the user expands an event
- **THEN** every webhook registered for that system and event is listed, sorted naturally by hook ID, and all result pages are fetched

#### Scenario: Event with no webhooks
- **WHEN** an event has no registered webhooks
- **THEN** it expands to nothing

#### Scenario: Listing fails
- **WHEN** listing the webhooks of an event fails
- **THEN** an error message "Could not list webhooks" is shown and the event expands to nothing

### Requirement: Webhook nodes and status badge

A webhook node SHALL be labeled with the hook ID. Its tooltip SHALL show "Webhook", the ID, the status (when known), the system, and the event. A webhook whose status is present and is not `active` SHALL show a `⊘` badge with the tooltip "Webhook is <status>", so inactive hooks are distinguishable without opening them.

#### Scenario: Active webhook
- **WHEN** a webhook has status `active`
- **THEN** no badge is shown

#### Scenario: Inactive webhook
- **WHEN** a webhook has a status other than `active` (for example `inactive`)
- **THEN** its node shows the `⊘` badge, dimmed, with the tooltip "Webhook is <status>"

#### Scenario: Status unknown
- **WHEN** the listing returns no status for a webhook
- **THEN** no badge is shown and the tooltip omits the status line

### Requirement: Refresh

`aps.wh.refreshWebhooks` SHALL be available in the title bar of both Webhooks views. Running it SHALL refresh both views and the status badges.

#### Scenario: Refreshing
- **WHEN** the user runs `aps.wh.refreshWebhooks`
- **THEN** the app and user views reload from the first level and badges are recomputed

### Requirement: Create webhook

`aps.wh.createWebhook` SHALL be available in the context menu of event nodes (not systems or hooks) in both views. It SHALL open a webview panel titled "Create Webhook" containing a form with: read-only System and Event, a Scope value input paired with a Scope key dropdown listing the scope keys the event supports (first one preselected), a Callback URL input, an optional Filter input, and an optional Attributes input, followed by a Create button.

On submit, the extension SHALL create the webhook for that system and event in the view's identity, with the chosen scope key/value pair and callback URL. An empty filter SHALL be omitted. A non-empty Attributes value SHALL be parsed as JSON and sent as the hook attributes; an empty value SHALL be omitted.

#### Scenario: Successful creation
- **WHEN** the user submits the form with valid values
- **THEN** a "Creating webhook" progress is shown, the panel closes, "Webhook created" is shown, and both Webhooks views refresh

#### Scenario: Creation fails
- **WHEN** the API rejects the request (for example an unreachable callback URL)
- **THEN** an error message "Could not create webhook" is shown and the panel stays open so the user can correct the values

#### Scenario: Attributes are not valid JSON
- **WHEN** the user submits an Attributes value that is not valid JSON
- **THEN** the same "Could not create webhook" error is shown, no webhook is created, and the panel stays open

#### Scenario: Closing the panel
- **WHEN** the user closes the panel without submitting
- **THEN** nothing is created

### Requirement: View webhook details

`aps.wh.viewWebhookDetails` SHALL be available in the context menu of webhook nodes. It SHALL fetch the hook's full details and open them as read-only JSON.

#### Scenario: Viewing details
- **WHEN** the user runs `aps.wh.viewWebhookDetails` on a webhook
- **THEN** a "Getting webhook details" progress is shown and the details open in a read-only JSON document

#### Scenario: Details cannot be retrieved
- **WHEN** fetching the details fails (for example the hook was deleted elsewhere)
- **THEN** an error message "Could not access webhook" is shown

### Requirement: Update webhook

`aps.wh.updateWebhook` SHALL be available in the context menu of webhook nodes. It SHALL first fetch the hook's details, then open a webview panel titled "Update Webhook: <id>" with the same form, showing read-only ID, Status, System, Event, Created by, Created on, URN, Tenant, Scope (key and value), and Callback URL, and editable Filter and Attributes inputs prefilled from the hook (Attributes as compact JSON). The submit button SHALL read "Update". Only the filter and attributes SHALL be updatable; an empty filter or attributes value SHALL be omitted from the request.

#### Scenario: Successful update
- **WHEN** the user submits the form
- **THEN** an "Updating webhook <id>" progress is shown, the panel closes, both Webhooks views refresh, and "Webhook updated: <id>" is shown

#### Scenario: Update fails
- **WHEN** the API rejects the update, or Attributes is not valid JSON
- **THEN** an error message "Could not update webhook" is shown and the panel stays open

#### Scenario: Details cannot be retrieved
- **WHEN** fetching the hook's details fails
- **THEN** an error message "Could not retrieve webhook" is shown and no panel opens

### Requirement: Delete webhook

`aps.wh.deleteWebhook` SHALL be available in the context menu of webhook nodes. It SHALL require confirmation in a modal dialog ("Are you sure you want to delete webhook <id>? This action cannot be undone.") with a "Delete" button before removing the hook.

#### Scenario: Confirmed deletion
- **WHEN** the user confirms with "Delete"
- **THEN** a "Removing webhook: <id>" progress is shown, "Webhook removed: <id>" is shown, and both Webhooks views refresh

#### Scenario: Cancelled deletion
- **WHEN** the user dismisses the dialog
- **THEN** the webhook is not deleted

#### Scenario: Deletion fails
- **WHEN** the API rejects the deletion
- **THEN** an error message "Could not remove webhook" is shown and the webhook remains

### Requirement: Menu placement

The context-menu entries SHALL be: `aps.wh.viewWebhookDetails`, `aps.wh.updateWebhook`, and `aps.wh.deleteWebhook` on webhook nodes, and `aps.wh.createWebhook` on event nodes, in both views. System nodes SHALL have no webhook context-menu commands.

#### Scenario: Context menu on a system node
- **WHEN** the user opens the context menu on a system node
- **THEN** none of the `aps.wh.*` commands (other than title-bar refresh) are offered
