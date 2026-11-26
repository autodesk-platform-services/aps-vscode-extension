# Secure service accounts

## Purpose

Manage Secure Service Accounts (SSAs) owned by the active environment's application (2-legged auth), and their keys, in the `apsSecureServiceAccountsView` view ("Secure Service Accounts (app)"). Users can create, inspect, enable/disable, and delete accounts and keys, generate private keys, and produce JWT assertions and access tokens for a key.

Out of scope: signing in with a secure service account as a user session (see `authentication`).

## Requirements

### Requirement: Account and key list

The view SHALL list the application's secure service accounts, each labeled with its e-mail address and expandable to its keys. Each account node SHALL have a tooltip showing "Secure Service Account", its ID, and its e-mail. Each key node SHALL be labeled with the key ID, with a tooltip showing "Secure Service Account Key", the ID, and the status. Key nodes SHALL have no children.

#### Scenario: Accounts are listed
- **WHEN** the view is first shown
- **THEN** all accounts of the application are fetched and listed

#### Scenario: Keys are listed
- **WHEN** the user expands an account
- **THEN** that account's keys are fetched and listed

#### Scenario: No accounts or no keys
- **WHEN** the application has no accounts, or an account has no keys
- **THEN** the view or the account expands to nothing

### Requirement: Refresh

`aps.ssa.refreshAccounts` SHALL be available in the view's title bar and SHALL reload the tree.

#### Scenario: Refreshing
- **WHEN** the user runs `aps.ssa.refreshAccounts`
- **THEN** the accounts and keys are fetched again

### Requirement: Target selection from the Command Palette

Every command that acts on an account SHALL, when run without a tree node (for example from the Command Palette), prompt the user to pick an account by e-mail ("Select secure service account"). Every command that acts on a key SHALL first prompt for an account, then for one of its keys by ID ("Select secure service account key"). Loading accounts and keys SHALL show a progress notification.

#### Scenario: Picking a target
- **WHEN** the user runs an account or key command from the Command Palette
- **THEN** the pickers are shown and the command continues with the selection

#### Scenario: No accounts
- **WHEN** the application has no accounts
- **THEN** "No secure service accounts found" is shown and the command ends

#### Scenario: No keys
- **WHEN** the chosen account has no keys
- **THEN** "No secure service account keys found" is shown and the command ends

#### Scenario: Cancelling a picker
- **WHEN** the user dismisses a picker
- **THEN** "No secure service account selected" or "No secure service account key selected" is shown and the command ends

#### Scenario: Loading fails
- **WHEN** loading accounts or keys fails
- **THEN** an error message "Could not load secure service accounts" or "Could not load secure service account keys" is shown and the command ends

### Requirement: Create account

The title bar of the view SHALL offer `aps.ssa.createAccount`. It SHALL prompt in order for a username, a first name, and a last name, then create the account.

#### Scenario: Successful creation
- **WHEN** the user enters all three values
- **THEN** a "Creating secure service account" progress is shown and "Secure service account created: <e-mail>" is shown

#### Scenario: Cancelling or empty input
- **WHEN** the user dismisses any prompt or submits an empty value
- **THEN** the command ends and no account is created

#### Scenario: Creation fails
- **WHEN** the API rejects the request
- **THEN** an error message "Could not create secure service account" is shown

Note: the tree is not refreshed automatically after creation; the user runs `aps.ssa.refreshAccounts` to see the new account.

### Requirement: View details and copy IDs

`aps.ssa.viewAccountDetails` and `aps.ssa.viewAccountKeyDetails` SHALL open the account's or key's details as read-only JSON. `aps.ssa.copyAccountID` and `aps.ssa.copyAccountKeyID` SHALL copy the ID to the clipboard and confirm with a notification.

#### Scenario: Viewing account details
- **WHEN** the user runs `aps.ssa.viewAccountDetails` on an account
- **THEN** its details open in a read-only JSON document

#### Scenario: Viewing key details
- **WHEN** the user runs `aps.ssa.viewAccountKeyDetails` on a key
- **THEN** the key's details open in a read-only JSON document

#### Scenario: Key no longer exists
- **WHEN** the key is not found among the account's keys
- **THEN** the error "Could not find secure service account key details: <id>" is shown

#### Scenario: Copying an ID
- **WHEN** the user runs `aps.ssa.copyAccountID` or `aps.ssa.copyAccountKeyID`
- **THEN** the ID is placed on the clipboard and a notification "Secure service account ID copied to clipboard" or "Secure service account key ID copied to clipboard" is shown

#### Scenario: Retrieval fails
- **WHEN** retrieving details fails
- **THEN** an error message "Could not retrieve secure service account details" or "Could not retrieve secure service account key details" is shown

### Requirement: Update account and key status

`aps.ssa.updateAccount` and `aps.ssa.updateAccountKey` SHALL prompt the user to pick a new status, `ENABLED` or `DISABLED`, and apply it.

#### Scenario: Changing status
- **WHEN** the user picks `ENABLED` or `DISABLED`
- **THEN** an "Updating..." progress is shown and "Secure service account updated: <id>" or "Secure service account key updated: <id>" is shown

#### Scenario: Cancelling the picker
- **WHEN** the user dismisses the status picker
- **THEN** nothing is changed

#### Scenario: Update fails
- **WHEN** the API rejects the change
- **THEN** an error message "Could not update secure service account" or "Could not update secure service account key" is shown

### Requirement: Delete account and key

`aps.ssa.deleteAccount` and `aps.ssa.deleteAccountKey` SHALL require confirmation in a modal dialog ("Are you sure you want to delete secure service account: <id>? This action cannot be undone." or the key equivalent) with a "Delete" button.

#### Scenario: Confirmed deletion
- **WHEN** the user confirms with "Delete"
- **THEN** a "Deleting..." progress is shown and "Secure service account deleted: <id>" or "Secure service account key deleted: <id>" is shown

#### Scenario: Cancelled deletion
- **WHEN** the user dismisses the dialog
- **THEN** nothing is deleted

#### Scenario: Deletion fails
- **WHEN** the API rejects the deletion
- **THEN** an error message "Could not delete secure service account" or "Could not delete secure service account key" is shown

### Requirement: Create account key

`aps.ssa.createAccountKey` SHALL generate a new key pair for an account and open the private key as read-only text, followed by a warning "Make sure to copy the private key as it will not be shown again!". The private key is returned only at creation.

#### Scenario: Successful generation
- **WHEN** the user runs `aps.ssa.createAccountKey` on an account
- **THEN** a "Generating private key for secure service account" progress is shown, the private key opens in a read-only document, and the warning is shown

#### Scenario: Generation fails
- **WHEN** the API rejects the request
- **THEN** an error message "Could not generate private key for secure service account" is shown

### Requirement: Generate assertion

`aps.ssa.generateAssertion` SHALL, for a key, prompt for a private key file (open dialog, `.pem` filter or all files), then prompt to multi-select scopes ("Select scopes", from the extension's default scope list), and then produce a signed JWT assertion using the environment's client ID, the account ID, and the key ID. The assertion SHALL be generated locally, without an API call. The user SHALL then choose "Open in New Tab" (read-only text) or "Copy to Clipboard" from an "Assertion generated" notification.

#### Scenario: Generating and copying
- **WHEN** the user selects a key file and at least one scope, and chooses "Copy to Clipboard"
- **THEN** the assertion is placed on the clipboard

#### Scenario: Opening in a tab
- **WHEN** the user chooses "Open in New Tab"
- **THEN** the assertion opens as read-only text

#### Scenario: Dismissing the notification
- **WHEN** the user dismisses the notification without choosing an action
- **THEN** the assertion is discarded

#### Scenario: Cancelling the file dialog
- **WHEN** the user cancels the open dialog
- **THEN** the command ends

#### Scenario: No scopes selected
- **WHEN** the user dismisses the scope picker or selects no scopes
- **THEN** the error "No scopes provided" is shown and the command ends

### Requirement: Generate access token

`aps.ssa.generateAccessToken` SHALL follow the same file and scope prompts as `aps.ssa.generateAssertion`, then exchange the assertion for an access token using the environment's client ID and secret, with progress "Generating access token...". The user SHALL then choose "Open in New Tab" (read-only JSON of the token response) or "Copy to Clipboard" (the JSON text) from an "Access token generated" notification.

#### Scenario: Successful exchange
- **WHEN** the user provides a key file and scopes
- **THEN** the token response is obtained and the "Access token generated" notification offers "Open in New Tab" and "Copy to Clipboard"

#### Scenario: Cancelling or no scopes
- **WHEN** the user cancels the file dialog, or selects no scopes
- **THEN** the command ends (with "No scopes provided" shown in the latter case) and no exchange is made

#### Scenario: Exchange fails
- **WHEN** the exchange is rejected (for example a wrong key file or a disabled key)
- **THEN** an error is reported to the user

### Requirement: Menu placement

Account nodes SHALL offer `aps.ssa.viewAccountDetails`, `aps.ssa.copyAccountID`, `aps.ssa.updateAccount`, `aps.ssa.deleteAccount`, and `aps.ssa.createAccountKey` in their context menu. Key nodes SHALL offer `aps.ssa.viewAccountKeyDetails`, `aps.ssa.updateAccountKey`, `aps.ssa.deleteAccountKey`, `aps.ssa.copyAccountKeyID`, `aps.ssa.generateAssertion`, and `aps.ssa.generateAccessToken`. The title bar SHALL offer `aps.ssa.refreshAccounts` and `aps.ssa.createAccount`.

#### Scenario: Context menu per node type
- **WHEN** the user opens the context menu on an account or a key
- **THEN** only the commands for that node type are offered
