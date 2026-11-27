# Issues

## Purpose

Browse Autodesk Construction Cloud (ACC) and BIM 360 issues in the user Issues view (`apsIssuesView`), using the signed-in user's (3-legged) access. Hubs and projects are listed as in the Hubs view, with the issues of each project beneath them. The `aps.issues.*` commands show the full details of an issue and copy its ID.

Out of scope: browsing folders, items, and versions (see `data-management`), creating or editing issues, and sign-in/sign-out.

## Requirements

### Requirement: Signed-in state

The Issues view SHALL show data only while a user session exists. When no user is signed in, the view SHALL be empty and SHALL show a welcome message, "ACC issues require a user context.", with a "Sign in to APS" link that runs `aps.auth.login`. When signed in, `aps.auth.logout` SHALL be available in the view's title bar.

#### Scenario: Not signed in
- **WHEN** the Issues view is shown and there is no user session
- **THEN** no hubs are requested, the view is empty, and the sign-in welcome message is shown

#### Scenario: Signed in
- **WHEN** the Issues view is shown with a user session
- **THEN** the hubs accessible to the user are listed at the root

### Requirement: Hubs, projects, and issues

The view SHALL list hubs at the root, the projects of each hub beneath them, and the issues of each project beneath those. Hubs and projects SHALL be labeled with their name, with a tooltip showing kind, ID, and name. All projects of a hub SHALL be loaded, following every page. Issues SHALL NOT have child nodes.

#### Scenario: Expanding a hub
- **WHEN** the user expands a hub
- **THEN** all of the hub's projects are listed

#### Scenario: Expanding a project
- **WHEN** the user expands a project
- **THEN** the project's issues are listed

#### Scenario: Project without issues
- **WHEN** a project has no issues
- **THEN** nothing is shown beneath it

### Requirement: Issue nodes

Each issue node SHALL be labeled `#<display ID> <title>` and SHALL show the issue's status as its description. A missing title SHALL be shown as `<no title>` and a missing status as `<no status>`. The tooltip SHALL show ID, display ID, title, status, assignee, and due date, with `<none>` for an absent assignee or due date.

#### Scenario: Issue with all fields
- **WHEN** an issue has a title, status, assignee, and due date
- **THEN** the node shows `#<display ID> <title>`, the status beside it, and all fields in the tooltip

#### Scenario: Issue without assignee or due date
- **WHEN** an issue has no assignee and no due date
- **THEN** the tooltip shows `Assigned to: <none>` and `Due date: <none>`

### Requirement: Error hints

When loading hubs, projects, or issues fails, the view SHALL show a single hint node in place of that level's children, with an explanatory tooltip. The failure SHALL NOT raise an error notification.

#### Scenario: Loading fails
- **WHEN** loading hubs, projects, or issues fails
- **THEN** a hint reads "Could not retrieve hubs.", "Could not retrieve projects.", or "Could not retrieve issues." respectively, and the tooltip names the API that failed

### Requirement: View issue details

`aps.issues.viewIssueDetails` SHALL be available on an issue node (inline context menu group `0_view`). It SHALL show a progress notification "Getting issue details: #<display ID>" while fetching the issue and its comments, then open a read-only JSON document containing the issue's full details plus a `comments` array. Running it again on the same issue SHALL reuse the same document tab.

#### Scenario: Viewing details
- **WHEN** the user runs `aps.issues.viewIssueDetails` on an issue
- **THEN** a read-only JSON document opens with the issue's details and its comments

#### Scenario: Issue without comments
- **WHEN** the issue has no comments
- **THEN** the document's `comments` array is empty

#### Scenario: Fetching fails
- **WHEN** fetching the issue details or comments fails
- **THEN** an error message titled "Could not access issue" is shown and no document is opened

#### Scenario: Triggered without a node
- **WHEN** the command is run from the Command Palette instead of the tree view
- **THEN** an error titled "Could not access issue" reports that the command can only be triggered from the tree view

### Requirement: Copy issue ID

`aps.issues.copyIssueID` SHALL copy the ID of the selected issue to the clipboard and show an information message "Issue ID copied to clipboard: <id>". It SHALL be available only on issue nodes in the Issues view.

#### Scenario: Copying an ID
- **WHEN** the user runs `aps.issues.copyIssueID` on an issue
- **THEN** the issue's ID is on the clipboard and the confirmation message is shown

#### Scenario: Triggered without a node
- **WHEN** the command is run from the Command Palette instead of the tree view
- **THEN** the error "This command can only be triggered from the tree view." is raised
