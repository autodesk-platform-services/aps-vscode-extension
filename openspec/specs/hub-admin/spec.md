# Hub admin

## Purpose

Browse the administrative data of Autodesk Construction Cloud and BIM 360 accounts (hubs): account users, projects, project users, and partner companies. The data is shown in two read-only tree views that share the same structure: the app view (`apsHubAdminAppView`, "Hub Admin (app)", 2-legged auth) and the user view (`apsHubAdminUserView`, "Hub Admin (user)", 3-legged auth with the active session). Commands let the user view the raw details of an item and copy its ID.

Out of scope: browsing hub folders, items, and versions (see `data-management`), and Team Admin data (see `team-admin`).

## Requirements

### Requirement: Hub list

Each view SHALL list the hubs available to its auth context as top-level nodes, showing the hub name. The tooltip SHALL show the hub ID, account ID (the hub ID without its `b.` prefix), and name. The app view SHALL use the active environment's application credentials; the user view SHALL use the signed-in user's session.

#### Scenario: Hubs are loaded
- **WHEN** a view is expanded
- **THEN** the hubs for that view's auth context are listed, each collapsed

#### Scenario: Listing hubs fails
- **WHEN** fetching hubs fails
- **THEN** a "Could not list hubs" error is shown and the view stays empty

#### Scenario: No hubs
- **WHEN** the auth context has no hubs
- **THEN** the view is empty

### Requirement: Sign-in required for the user view

The user view SHALL show no nodes while there is no user session, and SHALL instead show a welcome message "Hub Admin (user) data requires a user context." with a "Sign in to APS" link that runs `aps.auth.login`. The user view's title bar SHALL offer sign-out (`aps.auth.logout`) while a session exists. The app view SHALL NOT depend on a user session.

#### Scenario: Not signed in
- **WHEN** no user session exists and the user view is shown
- **THEN** the sign-in welcome message is displayed and no hubs are fetched

#### Scenario: Signed in
- **WHEN** a user session exists
- **THEN** the user view lists hubs and offers sign-out in its title bar

### Requirement: Hub structure

Expanding a hub SHALL show three category nodes in this order: "Users", "Projects", and "Companies".

#### Scenario: Expanding a hub
- **WHEN** the user expands a hub
- **THEN** the "Users", "Projects", and "Companies" categories are shown, each collapsed

### Requirement: Account users

Expanding a hub's "Users" category SHALL list the users of the account, sorted by name using natural, case-insensitive ordering. Each node SHALL show the user's name, or the e-mail address when the name is empty; its tooltip SHALL show ID, name, and e-mail. User nodes SHALL have no children.

#### Scenario: Users are listed
- **WHEN** the user expands the "Users" category
- **THEN** the account's users are listed, sorted by name

#### Scenario: Listing users fails
- **WHEN** fetching users fails
- **THEN** a "Could not list hub admin users" error is shown and the category is empty

### Requirement: Projects and project users

Expanding a hub's "Projects" category SHALL list the account's projects, sorted by name. Each project tooltip SHALL show ID and name. Expanding a project SHALL show a single "Users" category, which lists the users assigned to that project sorted by name, showing name (or e-mail when the name is empty) with a tooltip of ID, name, and e-mail. Project user nodes SHALL have no children.

#### Scenario: Projects are listed
- **WHEN** the user expands the "Projects" category
- **THEN** the account's projects are listed, sorted by name

#### Scenario: Listing projects fails
- **WHEN** fetching projects fails
- **THEN** a "Could not list hub admin projects" error is shown and the category is empty

#### Scenario: Project users are listed
- **WHEN** the user expands a project and then its "Users" category
- **THEN** the project's users are listed, sorted by name

#### Scenario: Listing project users fails
- **WHEN** fetching project users fails
- **THEN** a "Could not list project users" error is shown and the category is empty

### Requirement: Companies

Expanding a hub's "Companies" category SHALL list the account's partner companies, sorted by name. Each company node SHALL show its name, with a tooltip of ID and name, and SHALL have no children.

#### Scenario: Companies are listed
- **WHEN** the user expands the "Companies" category
- **THEN** the companies are listed, sorted by name

#### Scenario: Listing companies fails
- **WHEN** fetching companies fails
- **THEN** a "Could not list hub admin companies" error is shown and the category is empty

### Requirement: Result limits

Lists SHALL be fetched in a single request, without a "Load more…" node. Users and companies SHALL be capped at 100 entries; projects and project users SHALL be capped at 200 entries. Entries beyond the cap SHALL NOT be shown.

#### Scenario: Large account
- **WHEN** an account has more entries than the cap for a list
- **THEN** only the first entries up to the cap are listed

### Requirement: Refresh

`aps.hubAdmin.refresh` SHALL refresh both the app and the user views, discarding what was loaded and fetching it again on expansion. The command SHALL be available in the title bar of both views.

#### Scenario: Refreshing
- **WHEN** the user runs `aps.hubAdmin.refresh`
- **THEN** both Hub Admin views reload from the top

### Requirement: View details

The user SHALL be able to open the full details of a node as a read-only JSON document, with a progress notification while loading: `aps.hubAdmin.viewHubDetails` for a hub, `aps.hubAdmin.viewUserDetails` for a user, `aps.hubAdmin.viewProjectDetails` for a project, `aps.hubAdmin.viewProjectUserDetails` for a project user, and `aps.hubAdmin.viewCompanyDetails` for a company. Details SHALL be fetched with the same auth context as the view the node belongs to.

#### Scenario: Viewing details
- **WHEN** the user runs a view-details command on a node
- **THEN** a progress notification is shown and the details open in a read-only JSON document

#### Scenario: Retrieving details fails
- **WHEN** fetching the details fails
- **THEN** an error is shown with the title "Could not retrieve hub details", "Could not retrieve hub admin user details", "Could not retrieve hub admin project details", "Could not retrieve project user details", or "Could not retrieve hub admin company details", matching the command

#### Scenario: Not offered in the command palette
- **WHEN** the user opens the Command Palette
- **THEN** none of the view-details or copy-ID commands is listed, because they act on a tree node

### Requirement: Copy IDs

The user SHALL be able to copy the ID of a node to the clipboard: `aps.hubAdmin.copyUserID`, `aps.hubAdmin.copyProjectID`, `aps.hubAdmin.copyProjectUserID`, and `aps.hubAdmin.copyCompanyID`. A confirmation message SHALL show the copied ID. No copy-ID command SHALL exist for hubs.

#### Scenario: Copying an ID
- **WHEN** the user runs a copy-ID command on a node
- **THEN** the ID is written to the clipboard and a message such as "Hub admin user ID copied to clipboard: <id>" is shown (project user: "Project user ID copied to clipboard: <id>")

### Requirement: Menu placement

Each node type SHALL offer its view-details command, and its copy-ID command where one exists, in the context menu of both Hub Admin views. Category nodes SHALL offer no commands. The menus SHALL be declared in `package.json` and kept in sync with the registered command IDs.

#### Scenario: Context menu on a user
- **WHEN** the user right-clicks a user node in either view
- **THEN** `aps.hubAdmin.viewUserDetails` and `aps.hubAdmin.copyUserID` are offered

#### Scenario: Context menu on a category
- **WHEN** the user right-clicks a "Users", "Projects", or "Companies" category
- **THEN** no Hub Admin commands are offered
