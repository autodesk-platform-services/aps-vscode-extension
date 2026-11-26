# Token Flex

## Purpose

Explore Token Flex contracts of the signed-in user (3-legged auth) in the Token Flex (user) view (`apsTokenFlexView`): contracts, contract years, monthly usage, and data freshness. Commands provide contract details, a usage summary, a usage chart webview, and ad hoc usage queries. The Token Flex Usage Data API only returns contracts for Token Flex administrators.

Out of scope: signing in and out (see `authentication`), and the Business Success Plan Reporting view (see `bsp-reporting`). This capability has no settings of its own.

## Requirements

### Requirement: Sign-in requirement

The view SHALL show a welcome message with a "Sign in to APS" link (`aps.auth.login`) while there is no user session (`aps:userSession` is unset), and SHALL load no data in that state. When a user session exists, the view toolbar SHALL show `aps.tokenFlex.refresh` and `aps.auth.logout`.

#### Scenario: Not signed in
- **WHEN** the view is shown without a user session
- **THEN** the welcome message "Token Flex usage data requires a user context." is shown and no contracts are requested

#### Scenario: Refreshing
- **WHEN** the user runs `aps.tokenFlex.refresh`
- **THEN** the whole tree is reloaded from the API

### Requirement: Contract list

The view SHALL list the contracts the signed-in user administers. Each contract node SHALL be labeled with its name (or its number when the name is empty), show the contract number as its description (suffixed with "(inactive)" when the contract is not active), and be expandable. The tooltip SHALL show number, name, start date, end date, and whether the contract is active. Active contracts SHALL use a certificate icon and inactive contracts a "circle with slash" icon.

#### Scenario: Contracts found
- **WHEN** the view loads with a user session
- **THEN** each contract is listed as an expandable node

#### Scenario: No contracts
- **WHEN** the API returns no contracts
- **THEN** a "No contracts found." hint is shown, with a tooltip explaining that contracts are only listed for Token Flex administrators

#### Scenario: Loading contracts fails
- **WHEN** listing contracts fails
- **THEN** a "Could not retrieve contracts." hint is shown and the error is written to the extension log
- **AND** for HTTP 401 or 403 the hint tooltip tells the user to sign in as a Token Flex administrator with the `data:read` scope
- **AND** for other errors the tooltip includes the error message

### Requirement: Contract categories

Expanding a contract SHALL show three category nodes: "Contract Years", "Monthly Usage", and "Last Updated". Each SHALL load its entries when first expanded.

#### Scenario: Category is empty
- **WHEN** a category has no entries
- **THEN** a hint "No contract years found.", "No usage found.", or "No last updated dates found." is shown respectively

#### Scenario: Loading a category fails
- **WHEN** loading a category fails
- **THEN** a "Could not retrieve <what>." hint is shown, using the same error tooltips as for contract loading

### Requirement: Contract years

The "Contract Years" category SHALL list one node per contract year, labeled "Year N", with the description "<consumed>/<provisioned> tokens consumed" (numbers with thousands separators, "?" when missing). The tooltip SHALL show start and end dates and the provisioned, consumed, remaining, multi-year-at-start, and multi-year-consumed token counts.

#### Scenario: Contract with years
- **WHEN** the user expands "Contract Years"
- **THEN** a node per year is listed with its consumed and provisioned tokens

### Requirement: Monthly usage

The "Monthly Usage" category SHALL list monthly usage per usage category, newest month first and then by usage category name. Each node SHALL be labeled "YYYY-MM <usage category>", show "<tokens> tokens, <users> users" as its description, and show month, contract year, usage category, tokens consumed, and unique users in its tooltip.

#### Scenario: Sorted usage
- **WHEN** the user expands "Monthly Usage"
- **THEN** entries are ordered by month descending, with ties ordered by usage category ascending

### Requirement: Last updated dates

The "Last Updated" category SHALL list one node per usage category and charge category, labeled "<usage category> (<charge category>)", with the last usage date as description. The tooltip SHALL also show the last processed date.

#### Scenario: Viewing freshness
- **WHEN** the user expands "Last Updated"
- **THEN** each usage and charge category pair is listed with its last usage date

### Requirement: Contract details and contract number

On a contract, `aps.tokenFlex.viewContractDetails` SHALL show the full contract details as read-only JSON, and `aps.tokenFlex.copyContractNumber` SHALL copy the contract number to the clipboard and show "Contract number copied to clipboard: <number>".

#### Scenario: Viewing details
- **WHEN** the user runs `aps.tokenFlex.viewContractDetails` on a contract
- **THEN** a progress notification "Getting contract details: <number>" is shown and the details open as read-only JSON

#### Scenario: Failure
- **WHEN** retrieving details fails
- **THEN** the error "Could not retrieve contract details" is shown

#### Scenario: Run without a tree node
- **WHEN** either command is run from the Command Palette
- **THEN** the error "This command can only be triggered from the tree view." is shown

### Requirement: Usage summary

`aps.tokenFlex.viewUsageSummary` SHALL show the monthly usage summary of a contract as read-only JSON, with the internal entry type and contract number omitted from each entry. It SHALL be available on a contract, on its "Monthly Usage" category (also inline), and in the Command Palette.

#### Scenario: Triggered from the tree
- **WHEN** the user runs the command on a contract or its "Monthly Usage" node
- **THEN** the summary of that contract opens as JSON

#### Scenario: Triggered from the Command Palette
- **WHEN** the user runs the command without a tree node
- **THEN** the user is prompted to pick a contract (see "Contract prompt") and the summary of the chosen contract opens

#### Scenario: Cancelling the contract prompt
- **WHEN** the user dismisses the contract prompt
- **THEN** nothing happens

#### Scenario: Failure
- **WHEN** retrieving the summary fails
- **THEN** the error "Could not retrieve usage summary" is shown

### Requirement: Contract prompt

When a command needs a contract and is not triggered from one, it SHALL require a user session, otherwise failing with "The Token Flex Usage Data API requires a user context. Sign in to APS first." It SHALL then fetch the contracts: a single contract SHALL be used without asking, and several SHALL be offered in a quick-pick ("Select a Token Flex contract") showing name, number, date range, and "(inactive)" when applicable.

#### Scenario: No contracts
- **WHEN** the user has no contracts
- **THEN** the message "No Token Flex contracts found. Contracts are only listed for Token Flex administrators." is shown and the command ends

#### Scenario: Single contract
- **WHEN** exactly one contract exists
- **THEN** it is used without a prompt

### Requirement: Usage chart

`aps.tokenFlex.viewUsageChart` SHALL open a webview panel titled "Token Flex Usage: <contract name or number>" with bar charts for the contract. It SHALL be available on a contract, on its "Monthly Usage" category (both also inline), and in the Command Palette (which prompts for a contract).

The panel SHALL show a "Monthly usage" chart with one stacked or grouped bar series per usage category and one bar group per month (YYYY-MM, ascending, months without usage count as 0). A "Metric" dropdown SHALL switch between "Tokens consumed" and "Unique users", and a "Contract year" dropdown SHALL limit the chart to "All years" (default) or one "Year N". For "Tokens consumed" the bars SHALL be stacked and the total SHALL be shown ("Total: N tokens"); for "Unique users" they SHALL not be stacked.

A "Tokens per contract year" chart SHALL be shown when the contract has years: per year, a stacked "Consumed" and "Remaining" bar (remaining clamped to at least 0), plus a separate "Multi-year consumed" bar when any year has multi-year consumption.

#### Scenario: Opening the chart
- **WHEN** the user runs the command for a contract
- **THEN** a progress notification "Getting usage data: <number>" is shown while details and summary are fetched, then the panel opens

#### Scenario: Re-running for the same contract
- **WHEN** a chart panel for that contract is already open
- **THEN** that panel is refreshed with the new data and revealed instead of opening another one

#### Scenario: Panel closed
- **WHEN** the user closes the panel and runs the command again
- **THEN** a new panel opens

#### Scenario: No usage data
- **WHEN** the selected year or the contract has no usage entries
- **THEN** the panel shows "No usage data available." in place of the monthly chart

#### Scenario: Contract without years
- **WHEN** the contract has no contract years
- **THEN** the "Tokens per contract year" chart is omitted

#### Scenario: Failure
- **WHEN** fetching the data fails
- **THEN** the error "Could not show usage chart" is shown

#### Scenario: Cancelled prompt
- **WHEN** the contract prompt is dismissed
- **THEN** no panel opens

### Requirement: Ad hoc usage query

`aps.tokenFlex.runUsageQuery` SHALL build a usage query from a sequence of prompts and show the result as read-only JSON. It SHALL be available on a contract (context menu and inline) and in the Command Palette (which prompts for a contract; a "Monthly Usage" node is not a contract and also leads to the prompt).

The prompts SHALL be, in order: a multi-select of fields to group by (`productName` preselected), a multi-select of metrics (`tokensConsumed` preselected), a multi-select of usage categories (empty means all), and an optional `where` input box. Empty `where` input (after trimming) SHALL be omitted from the query.

The query SHALL run with a cancellable progress notification "Running usage query: <number>" that shows the current query status. The result SHALL open as JSON containing the query, the total row count, and rows as objects keyed by column name. All result pages SHALL be collected before showing them.

#### Scenario: Cancelling a prompt
- **WHEN** the user dismisses any quick-pick or the `where` input box
- **THEN** nothing is run

#### Scenario: No fields and no metrics
- **WHEN** the user selects neither fields nor metrics
- **THEN** the error "A usage query needs at least one field or metric." is shown (prefixed by "Could not run usage query")

#### Scenario: Cancelling the running query
- **WHEN** the user cancels the progress notification
- **THEN** the message "Usage query monitoring cancelled" is shown and no results are displayed

#### Scenario: Query ends unsuccessfully
- **WHEN** the query ends with status `FAILED`, `TIMEOUT`, or `EXPIRED`, or its results disappear while paging
- **THEN** an error is shown ("Could not run usage query")

#### Scenario: Empty result
- **WHEN** the query completes with no rows
- **THEN** the JSON is shown with `total` 0 and an empty `rows` array
