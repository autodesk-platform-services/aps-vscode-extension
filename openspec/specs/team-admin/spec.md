# Team admin

## Purpose

Browse and manage the teams the signed-in user administers through the Team Admin API (Beta): team users, product pools (seat inventory), and product assignments. Data is shown in the user Team Admin view (`apsTeamAdminView`, "Team Admin (user)"), with commands for inviting users and assigning or unassigning products. The view requires a user (3-legged) session and is opt-in through the `autodesk.forge.enableTeamAdminApi` setting.

Out of scope: hub, project, and company administration (see `hub-admin`), and the sign-in flows themselves (see `authentication`).

## Requirements

### Requirement: Opt-in through a setting

The Team Admin API SHALL be disabled by default (`autodesk.forge.enableTeamAdminApi`, default `false`). While it is disabled the view SHALL show no nodes. Enabling it SHALL make the 3-legged OAuth sign-in request the additional scopes `tmadmapi:team:read`, `tmadmapi:team-users:write`, and `tmadmapi:team-products:write`. Changing the setting SHALL refresh the view.

#### Scenario: Setting is off
- **WHEN** a user session exists and `autodesk.forge.enableTeamAdminApi` is `false`
- **THEN** the view shows a welcome message that the Team Admin API (Beta) is disabled, with an "Enable Team Admin API" link that opens that setting, and tells the user to sign out and sign in again with 3-legged OAuth after enabling it

#### Scenario: Setting is turned on
- **WHEN** the user enables `autodesk.forge.enableTeamAdminApi`
- **THEN** the view refreshes immediately, but teams are only listed once the session has the Team Admin scopes (see "Session eligibility")

#### Scenario: Sign-in with the setting on
- **WHEN** the user signs in with 3-legged OAuth while the setting is `true`
- **THEN** the Team Admin scopes are requested in addition to the default scopes

### Requirement: Sign-in required

The view SHALL show no nodes while there is no user session, and SHALL instead show a welcome message "Team Admin data requires a user context." with a "Sign in to APS" link that runs `aps.auth.login`. The view's title bar SHALL offer sign-out (`aps.auth.logout`) while a session exists.

#### Scenario: Not signed in
- **WHEN** no user session exists
- **THEN** the sign-in welcome message is shown and no teams are fetched

### Requirement: Session eligibility

When the setting is enabled and a session exists, the view SHALL check that the session can use the Team Admin API before listing teams.

#### Scenario: Service account session
- **WHEN** the session was created with a Secure Service Account
- **THEN** a single hint "Service accounts are not supported." is shown, with a tooltip explaining that the API only accepts 3-legged tokens authorized by a team administrator

#### Scenario: Session without Team Admin scopes
- **WHEN** the session is not a pasted token and none of its scopes start with `tmadmapi:`
- **THEN** a single hint "Sign in again to grant Team Admin scopes." is shown, with a tooltip telling the user to sign out and sign in again

#### Scenario: Pasted token
- **WHEN** the session was created from a pasted token
- **THEN** the scope check is skipped and teams are requested with that token

### Requirement: Team list

The view SHALL list the teams the signed-in user administers as top-level nodes showing the team name (or the team ID when it has no name). The tooltip SHALL show ID and name. All pages of teams SHALL be fetched.

#### Scenario: Teams are loaded
- **WHEN** the view is shown for an eligible session
- **THEN** the user's teams are listed, each collapsed

#### Scenario: No teams
- **WHEN** the user administers no teams
- **THEN** a "No teams found." hint is shown

#### Scenario: Loading fails
- **WHEN** fetching a list fails
- **THEN** a "Could not retrieve <what>." hint (for example "Could not retrieve teams.") is shown in place of the list, the error is logged, and no error dialog is shown

#### Scenario: Access denied
- **WHEN** the API responds with status 403
- **THEN** the hint's tooltip says to make sure the APS app has the Team Admin API enabled and that the user administers the team; for other failures it shows the error message

### Requirement: Team structure

Expanding a team SHALL show two category nodes: "Users" and "Product Pools".

#### Scenario: Expanding a team
- **WHEN** the user expands a team
- **THEN** the "Users" and "Product Pools" categories are shown, each collapsed

### Requirement: Team users

Expanding "Users" SHALL list all users of the team. Each node SHALL show the user's name (first and last name, or the e-mail when there is no name) with the role as its description, and its tooltip SHALL show ID, name, e-mail, role, and whether registration is pending. Users whose e-mail is not verified SHALL be shown with a mail icon, and other users with a person icon. Each user node SHALL be expandable to show the user's product assignments.

#### Scenario: Users are listed
- **WHEN** the user expands "Users"
- **THEN** all pages of users are listed with their roles

#### Scenario: Pending invitation
- **WHEN** a user has not verified their e-mail
- **THEN** the tooltip says "Registration pending: yes" and the node uses the mail icon

#### Scenario: No users
- **WHEN** the team has no users
- **THEN** a "No users found." hint is shown

### Requirement: Product pools

Expanding "Product Pools" SHALL list the team's product pools. Each node SHALL show the product name (or product ID when unnamed) with seat usage as its description, formatted `<assigned>/<total> seats` (using `?` for an unknown number) or `unlimited seats` for unlimited pools. The tooltip SHALL show product ID, product name, seats, start date, and end date. Each pool SHALL be expandable to show the assignments of that product.

#### Scenario: Pools are listed
- **WHEN** the user expands "Product Pools"
- **THEN** all pages of pools are listed with their seat usage

#### Scenario: No pools
- **WHEN** the team has no product pools
- **THEN** a "No product pools found." hint is shown

### Requirement: Assignments

Expanding a user SHALL list that user's product assignments, labeled by product name, and expanding a product pool SHALL list that product's assignments, labeled by user e-mail. Each assignment SHALL show its type (`TEAM`, `DIRECT`, or `GROUP`) as its description, and its tooltip SHALL show user ID, e-mail, product ID, product name, and type. Direct assignments SHALL use a different icon than inherited ones. Assignments SHALL be fetched in a single, non-paginated request.

#### Scenario: Assignments of a user
- **WHEN** the user expands a user node
- **THEN** the user's assignments are listed by product name

#### Scenario: Assignments of a product pool
- **WHEN** the user expands a product pool
- **THEN** the assignments of that product are listed by user e-mail

#### Scenario: No assignments
- **WHEN** there are no assignments
- **THEN** a "No assignments found." hint is shown

### Requirement: Refresh

`aps.teamAdmin.refresh` SHALL refresh the view, discarding loaded data. The command SHALL be available in the view's title bar.

#### Scenario: Refreshing
- **WHEN** the user runs `aps.teamAdmin.refresh`
- **THEN** the view reloads from the top

### Requirement: View details and copy IDs

The user SHALL be able to open the details of a team (`aps.teamAdmin.viewTeamDetails`), user (`aps.teamAdmin.viewUserDetails`), or product pool (`aps.teamAdmin.viewProductPoolDetails`) as a read-only JSON document, and copy the ID of a team (`aps.teamAdmin.copyTeamID`), user (`aps.teamAdmin.copyUserID`), or product (`aps.teamAdmin.copyProductID`) to the clipboard. User details SHALL include the user's product assignments. Team and user details SHALL be fetched with a progress notification.

#### Scenario: Viewing details
- **WHEN** the user runs a view-details command on a node
- **THEN** the details open in a read-only JSON document

#### Scenario: Team not found
- **WHEN** the team can no longer be found while loading details
- **THEN** a "Could not retrieve team details" error is shown

#### Scenario: Loading user or team details fails
- **WHEN** fetching details fails
- **THEN** a "Could not retrieve team details" or "Could not retrieve team user details" error is shown

#### Scenario: Copying an ID
- **WHEN** the user runs a copy-ID command
- **THEN** the ID is copied and a message such as "Team ID copied to clipboard: <id>", "Team user ID copied to clipboard: <id>", or "Product ID copied to clipboard: <id>" is shown

#### Scenario: Run from the command palette
- **WHEN** any Team Admin command other than refresh is invoked without a tree node
- **THEN** it fails with "This command can only be triggered from the tree view."; these commands are hidden from the command palette

### Requirement: Add user

`aps.teamAdmin.addUser` SHALL invite a user to a team by e-mail. It SHALL be available from a team node and from its "Users" category (as an inline button on the category). It SHALL prompt for an e-mail address (validated as `name@domain.tld`), then an optional first name and an optional last name, which are only sent when non-empty. On success it SHALL show "User added to team: <e-mail> (<role>). They may need to accept the invitation." and refresh the view.

#### Scenario: Successful invitation
- **WHEN** the user enters a valid e-mail and confirms the optional name prompts
- **THEN** the user is added, the message is shown, and the view refreshes

#### Scenario: Invalid e-mail
- **WHEN** the entered e-mail does not look like an address
- **THEN** the input box shows "Enter a valid e-mail address" and does not accept it

#### Scenario: Cancelled input
- **WHEN** the user dismisses the e-mail, first name, or last name prompt, or submits an empty e-mail
- **THEN** nothing is added

#### Scenario: Already on the team
- **WHEN** the e-mail belongs to a user already on the team
- **THEN** the existing user is returned, no invitation is sent, and the same success message is shown

#### Scenario: Invitation fails
- **WHEN** the API rejects the request
- **THEN** a "Could not add user to team" error is shown

### Requirement: Assign product

`aps.teamAdmin.assignProduct` SHALL give a user a direct seat from a product pool, with a progress notification, and on success show "<product> assigned to <e-mail> (<type>)." and refresh the view. The command SHALL be available from a user node (prompting for the product pool), a product pool node (prompting for the user), and the "Product Pools" category (prompting for the pool, then the user). Pool choices SHALL show product name, seat usage, and validity dates; user choices SHALL show name, e-mail, and role.

#### Scenario: Assigning from a user
- **WHEN** the user runs the command on a user and picks a pool
- **THEN** the product is assigned to that user

#### Scenario: Assigning from a product pool
- **WHEN** the user runs the command on a pool and picks a user
- **THEN** the product is assigned to that user

#### Scenario: Assigning from the category
- **WHEN** the user runs the command on "Product Pools" and picks a pool and a user
- **THEN** the product is assigned to that user

#### Scenario: No pools or users
- **WHEN** the team has no product pools, or no users
- **THEN** "This team has no product pools that can be assigned." or "This team has no users." is shown and nothing is assigned

#### Scenario: Cancelled picker
- **WHEN** the user dismisses either quick pick
- **THEN** nothing is assigned

#### Scenario: Already assigned
- **WHEN** the user already has a direct assignment of the product
- **THEN** the request has no effect, and the current assignment is reported in the success message

#### Scenario: Assignment fails
- **WHEN** the API rejects the request
- **THEN** a "Could not assign product" error is shown

### Requirement: Unassign product

`aps.teamAdmin.unassignProduct` SHALL remove a user's direct assignment of a product, releasing its seat. It SHALL be available only on direct assignment nodes (as a context-menu item and an inline button). It SHALL require confirmation in a modal dialog, "Remove the direct assignment of <product> from <e-mail>? The user keeps any access inherited through the team or a group.", with an "Unassign" button. The view SHALL refresh after success.

#### Scenario: Confirming
- **WHEN** the user clicks "Unassign"
- **THEN** the assignment is removed, "<product> unassigned from <e-mail>." is shown, and the view refreshes

#### Scenario: Declining
- **WHEN** the user dismisses the dialog
- **THEN** nothing is removed

#### Scenario: Inherited assignment
- **WHEN** an assignment is of type `TEAM` or `GROUP`
- **THEN** the unassign command is not offered on it

#### Scenario: Unassignment fails
- **WHEN** the API rejects the request
- **THEN** a "Could not unassign product" error is shown

### Requirement: Menu placement

Team nodes SHALL offer view details and copy ID under a "view" group and add user under an "action" group. "Users" categories SHALL offer add user (context menu and inline). User nodes SHALL offer view details, copy ID, and assign product. "Product Pools" categories SHALL offer assign product. Product pool nodes SHALL offer view details, copy product ID, and assign product (context menu and inline). Direct assignment nodes SHALL offer unassign. The menus SHALL be declared in `package.json` and kept in sync with the registered command IDs.

#### Scenario: Context menu on a product pool
- **WHEN** the user right-clicks a product pool
- **THEN** view details, copy product ID, and assign product are offered, and user-only commands are not
