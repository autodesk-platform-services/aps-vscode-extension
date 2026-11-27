# Business Success Plan reporting

## Purpose

Explore Business Success Plan (BSP) reporting data of the signed-in user (3-legged auth) in the Business Success Plan Reporting (user) view (`apsBspReportingView`): the teams the user administers, ad hoc usage queries with an optional chart, a usage chart, and exports that can be created, inspected, and downloaded. The API only returns teams for admins of teams with BSP benefits.

Out of scope: signing in and out (see `authentication`), and Token Flex usage (see `token-flex`). This capability has no settings of its own.

## Requirements

### Requirement: Sign-in requirement

The view SHALL show a welcome message with a "Sign in to APS" link (`aps.auth.login`) while there is no user session, and SHALL load no data in that state. With a session, the view toolbar SHALL show `aps.bspReporting.refresh` and `aps.auth.logout`.

#### Scenario: Not signed in
- **WHEN** the view is shown without a user session
- **THEN** "Business Success Plan reporting data requires a user context." is shown and no API calls are made

#### Scenario: Refreshing
- **WHEN** the user runs `aps.bspReporting.refresh`
- **THEN** the whole tree is reloaded

### Requirement: Teams

The view SHALL have an expanded "Teams" node listing the teams the user can report on, sorted by name (or ID when there is no name). Each team node SHALL be labeled with its name or ID, show its ID as description, and show ID, name, and reporting benefits (or "none") in its tooltip. `aps.bspReporting.copyTeamId` SHALL copy a team's ID and show "Team ID copied to clipboard: <id>".

#### Scenario: Teams found
- **WHEN** the view loads with a user session
- **THEN** the teams are listed under "Teams"

#### Scenario: No teams
- **WHEN** no teams are returned
- **THEN** a "No teams found." hint is shown with a tooltip that teams are only listed for admins of teams with Business Success Plan benefits

#### Scenario: Loading fails
- **WHEN** loading teams or exports fails
- **THEN** a "Could not retrieve teams." (or "...exports.") hint is shown and the error is logged
- **AND** for HTTP 401 or 403 the tooltip asks the user to sign in as an admin of a team with BSP benefits, with the `data:read` scope; otherwise it includes the error message

#### Scenario: Copy without a node
- **WHEN** `aps.bspReporting.copyTeamId` is run from the Command Palette
- **THEN** the error "This command can only be triggered from the tree view." is shown

### Requirement: Exports list

The view SHALL have a collapsed "Exports" node listing the export requests of the last two weeks, newest first. Each export SHALL be labeled with its reports (or ID), describe its timestamp (YYYY-MM-DD HH:MM, UTC), output format, and team name ("all teams" if none), and show ID, creation time, status, format, reports, and team in its tooltip. The icon SHALL reflect the status: spinning for `SUBMITTED`, check for `COMPLETED`, history for `EXPIRED`, error for `ERROR`, file otherwise. Completed exports with downloads SHALL be expandable and list one node per downloadable file, labeled by report type with the output format as description.

#### Scenario: No exports
- **WHEN** there are no exports
- **THEN** a "No exports found." hint is shown, with a tooltip suggesting "Create Export" and noting that exports are deleted after two weeks

#### Scenario: Export not completed
- **WHEN** an export is not `COMPLETED`
- **THEN** it has no children

### Requirement: Team prompt

When a command needs a team and is not triggered from a team node, it SHALL require a user session, otherwise failing with "The Business Success Plan Reporting API requires a user context. Sign in to APS first." It SHALL then offer a quick-pick ("Select a team") with "All teams" first, followed by each team (name, ID, and benefits).

#### Scenario: No teams
- **WHEN** the user has no teams
- **THEN** the message "No teams found. Teams are only listed for admins of teams with Business Success Plan benefits." is shown and the command ends

#### Scenario: All teams
- **WHEN** the user picks "All teams"
- **THEN** the query or export is not restricted to a team

#### Scenario: Cancelled
- **WHEN** the user dismisses the pick
- **THEN** nothing happens

### Requirement: Ad hoc usage query

`aps.bspReporting.runUsageQuery` SHALL build a usage query from prompts and show the result as read-only JSON. It SHALL be available on a team and on the "Teams" node (both also inline) and in the Command Palette; on a team it queries that team, otherwise the team prompt is shown.

The prompts SHALL be: a multi-select of fields to group by (`productName` preselected), a multi-select of metrics (`uniqueUsers` preselected), an optional `where` input, and an optional `orderBy` input. Blank `where` and `orderBy` SHALL be omitted. A chosen team SHALL be sent as the query's `contextId`.

The query SHALL run with a cancellable progress notification showing its status. The JSON SHALL contain the query, the total row count, and rows as objects keyed by column name; all result pages SHALL be collected.

#### Scenario: Cancelling a prompt
- **WHEN** the user dismisses any quick-pick or input box
- **THEN** nothing is run

#### Scenario: No fields and no metrics
- **WHEN** neither fields nor metrics are selected
- **THEN** the error "A usage query needs at least one field or metric." is shown

#### Scenario: Cancelling the running query
- **WHEN** the user cancels the progress notification
- **THEN** "Usage query monitoring cancelled" is shown and no results are displayed

#### Scenario: Query ends in error
- **WHEN** the query ends with status `ERROR` or `EXPIRED`, or results disappear while paging
- **THEN** the error "Could not run usage query" is shown

#### Scenario: Offer to chart results
- **WHEN** the query returns at least one row
- **THEN** after the JSON opens, "Usage query completed: N rows" is shown with a "View Chart" action, which opens the usage chart for the results

#### Scenario: No rows
- **WHEN** the query returns no rows
- **THEN** the JSON is shown with `total` 0 and no "View Chart" offer

### Requirement: Usage chart

`aps.bspReporting.viewUsageChart` SHALL run a usage query and show the result in a webview panel titled "Business Success Plan Usage: <team name, ID, or All teams>". It SHALL be available on a team and on the "Teams" node (both also inline) and in the Command Palette (team prompt).

It SHALL use the same prompts as `aps.bspReporting.runUsageQuery`, preselecting the fields `usageMonth` and `productName`, the metrics `uniqueUsers`, `totalTokens`, and `totalUniqueDays`, and a `where` of `usageDate >= '<first day of the month 12 months ago>'` (UTC).

The panel SHALL show the title, the row count, and the `where` and `orderBy` clauses. A "Metric" dropdown SHALL list columns whose values are all numeric. An "X-axis" dropdown SHALL list the other columns (shown when there are any); it SHALL default to `usageMonth`, `usageWeek`, or `usageDate` when present, else the first such column. A "Group by" dropdown (shown with more than one such column) SHALL split bars into series, defaulting to the next column, and choosing the x-axis column as group clears the grouping. A "Stacked" checkbox SHALL appear when more than one series exists and be off by default. Values SHALL be summed per x value and series; empty values SHALL be labeled "(none)". Date-like x values SHALL be sorted ascending and the latest 50 kept; other x values SHALL be sorted by total descending and the top 50 kept. Only the 10 largest series SHALL be charted, and notes SHALL state how many x values or series were omitted.

#### Scenario: Re-running for the same team
- **WHEN** a panel for that team (or all teams) is already open
- **THEN** it is refreshed with the new results and revealed instead of opening another

#### Scenario: Chart opened from a query
- **WHEN** the user picks "View Chart" after `aps.bspReporting.runUsageQuery`
- **THEN** a panel titled "Usage Query: <query ID>" opens; it is not tracked for reuse

#### Scenario: Empty result
- **WHEN** the query returns no rows
- **THEN** the panel shows "The query returned no usage data. Try a longer period, a different team, or fewer conditions in the where clause."

#### Scenario: No numeric columns
- **WHEN** no result column is numeric
- **THEN** the panel shows "The query results have no numeric columns to chart. Include at least one metric in the query."

#### Scenario: Cancelled
- **WHEN** the user dismisses a prompt or cancels the running query
- **THEN** no panel opens; cancelling the query shows "Usage query monitoring cancelled"

#### Scenario: Failure
- **WHEN** the query fails
- **THEN** the error "Could not show usage chart" is shown

### Requirement: Create export

`aps.bspReporting.createExport` SHALL request a new export, wait for it to finish, and offer to download it. It SHALL be available on a team and on the "Exports" node (both also inline) and in the Command Palette; on a team it exports that team, otherwise the team prompt is shown.

The prompts SHALL be: an output format (`CSV`, `EXCEL`, or `JSON`), then a multi-select of reports (`SUBSCRIPTIONS`, `USERS`, `GROUPS`, `USAGE`, `USAGE_REPORT`) of which at least one must be chosen. When `USAGE` or `USAGE_REPORT` is selected, the user SHALL be asked for a start and end date (`YYYY-MM-DD`, UTC), defaulting to 30 days ago and today. Dates SHALL be validated: invalid formats are rejected ("Enter a date as YYYY-MM-DD"), an end before the start is rejected, and with `USAGE_REPORT` a range over 365 days is rejected ("Usage reports can cover at most 365 days"). The range SHALL be sent from 00:00:00Z of the start day to 23:59:59Z of the end day. `USAGE_REPORT` exports SHALL be requested as usage by product.

#### Scenario: Cancelling a prompt
- **WHEN** the user dismisses the format, reports, or date prompts, or selects no reports
- **THEN** no export is requested

#### Scenario: Export completes
- **WHEN** the export reaches `COMPLETED`
- **THEN** "Export completed: <id>" is shown with a "Download" action, and the tree is refreshed
- **AND** choosing "Download" starts the download flow for that export

#### Scenario: Cancelling the wait
- **WHEN** the user cancels the progress notification "Exporting <reports>"
- **THEN** a message says the export keeps running and will appear under "Exports" when complete, and the tree is refreshed

#### Scenario: Export fails
- **WHEN** the export ends with status `ERROR` or `EXPIRED`
- **THEN** the error "Could not create export" is shown and the tree is refreshed

### Requirement: Export details

`aps.bspReporting.viewExportDetails` SHALL show the details of an export as read-only JSON. It SHALL be available on exports (any status) and run with a progress notification "Getting export details: <id>".

#### Scenario: Viewing details
- **WHEN** the user runs the command on an export
- **THEN** the details open as read-only JSON

#### Scenario: Failure
- **WHEN** retrieving details fails
- **THEN** the error "Could not retrieve export details" is shown

#### Scenario: Run without a tree node
- **WHEN** the command is run from the Command Palette
- **THEN** the error "This command can only be triggered from the tree view." is shown

### Requirement: Download export

`aps.bspReporting.downloadExport` SHALL save one file of a completed export. It SHALL be available on completed exports and on download nodes (inline too), and in the Command Palette.

From a download node the file is that download. From an export, a single download is used directly and several are offered in a quick-pick ("Select a file to download"). From the Command Palette the user first picks among completed exports ("Select an export"; label shows reports, description timestamp and format, detail shows team or "All teams").

A save dialog SHALL suggest `<report type in lowercase>-<export ID>.<ext>` with `csv`, `xlsx`, or `json` by format. The download SHALL run with a cancellable progress notification, fetching a fresh download link first because links expire after a few minutes. On success "Download complete: <path>" SHALL be shown with an "Open File" action.

#### Scenario: No completed exports
- **WHEN** run from the Command Palette and none are completed
- **THEN** "No completed exports found. Exports are deleted after two weeks." is shown and the command ends

#### Scenario: Export has no downloads
- **WHEN** a chosen export has no downloads
- **THEN** the error "Export <id> has no downloads." is shown (prefixed by "Could not download export")

#### Scenario: Cancelling a prompt
- **WHEN** the user dismisses the export pick, file pick, or save dialog
- **THEN** nothing is downloaded

#### Scenario: Cancelling the download
- **WHEN** the user cancels the progress notification
- **THEN** "Download cancelled: <path>" is shown

#### Scenario: Export no longer completed
- **WHEN** the export is not `COMPLETED` at download time, or its download link is missing, or the file request fails
- **THEN** the error "Could not download export" is shown
