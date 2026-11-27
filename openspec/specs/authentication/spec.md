# Authentication

## Purpose

Authenticate the extension against APS in two coexisting contexts. The app (2-legged) context uses the active environment's client credentials and needs no sign-in. The user (3-legged) context uses a single sign-in session per environment and gates the user views (Hubs, Issues, Webhooks (user), Hub Admin (user), Team Admin, Token Flex, Business Success Plan reporting). Commands: `aps.auth.login`, `aps.auth.logout`, and `aps.auth.getAccessToken`.

Out of scope: choosing the active environment (see `environment-management`), and the contents of the user views.

## Requirements

### Requirement: App and user contexts

Views and commands that use the application's own credentials (object storage, Design Automation, secure service accounts, app webhooks, app Hub Admin) SHALL work without signing in, using 2-legged tokens cached per scope set and renewed shortly before they expire. User views SHALL require a signed-in session. While no session exists, each user view SHALL show a welcome message with a "Sign in to APS" link that runs `aps.auth.login`.

#### Scenario: Not signed in
- **WHEN** no session exists for the active environment
- **THEN** app views load normally and user views show a "requires a user context" message with a sign-in link

#### Scenario: Signed in
- **WHEN** a session exists
- **THEN** the user views replace their welcome messages with content and the `aps:userSession` context is set

### Requirement: Sign in

`aps.auth.login` ("Login") SHALL start sign-in through the APS authentication provider (provider ID `aps`) and always show the mode picker, even if a session exists. The picker, with the placeholder "Select an APS authentication method", SHALL offer: "3-legged OAuth", "3-legged OAuth with PKCE", "Secure Service Account", and "Paste access token". On success the session SHALL be stored for the active environment, services SHALL be rebuilt with it, and the user views SHALL refresh.

#### Scenario: Successful sign in
- **WHEN** the user completes any sign-in mode
- **THEN** the session is stored, `aps:userSession` is set, and the user views reload with the new session

#### Scenario: Cancelling sign in
- **WHEN** the user dismisses any step of the sign-in flow (the mode picker, the account or key picker, the token input, the private key file dialog, or the scope picker)
- **THEN** no session is created and no message is shown

#### Scenario: Sign-in fails
- **WHEN** any sign-in step fails
- **THEN** a warning "Could not log in: <error message>" is shown and the previous state is unchanged

### Requirement: 3-legged OAuth and PKCE

Both OAuth modes SHALL open the APS authorization page in the system browser and receive the result through a URI handler at `<uriScheme>://<publisher>.<name>/callback`, where `<uriScheme>` is the scheme of the hosting editor (for example `vscode` or `cursor`). No local HTTP server SHALL be used. The redirect URI SHALL be identical across logins (the transient `windowId` query parameter SHALL be removed). The request SHALL carry a random `state` that the callback must echo. "3-legged OAuth" SHALL use the environment's client ID and secret. "3-legged OAuth with PKCE" SHALL use a code challenge/verifier and no client secret. The requested scopes SHALL be the default scope list, plus the Team Admin scopes when `autodesk.forge.enableTeamAdminApi` is true.

#### Scenario: Callback received
- **WHEN** the browser redirects to the callback URI with a code and the matching `state`
- **THEN** the code is exchanged for tokens, and the session is labelled "3-legged" or "3-legged (PKCE)"

#### Scenario: Callback URL reminder
- **WHEN** the user signs in with an OAuth mode and has not yet acknowledged the reminder for this environment's client ID
- **THEN** an information message shows the exact callback URL that must be registered on the APS app, with the actions "Copy URL & Open APS Dev Portal" and "Got it, don't show again"

#### Scenario: Reminder acknowledged
- **WHEN** the user chooses either action
- **THEN** the reminder is not shown again for that client ID, and "Copy URL & Open APS Dev Portal" first copies the URL to the clipboard and opens `https://aps.autodesk.com/myapps`

#### Scenario: Reminder dismissed
- **WHEN** the user dismisses the reminder without choosing an action
- **THEN** sign-in continues and the reminder is shown again on the next attempt

#### Scenario: Authorization error
- **WHEN** the callback contains an `error` parameter
- **THEN** sign-in fails with the `error_description` if present, otherwise the error code

#### Scenario: Callback without a code
- **WHEN** the callback has a matching `state` but no `code`
- **THEN** sign-in fails with "Authorization callback did not include a code."

#### Scenario: Unknown or repeated callback
- **WHEN** a callback arrives with a missing, unknown, or already used `state`
- **THEN** it is ignored

#### Scenario: Timeout
- **WHEN** no callback arrives within 2 minutes
- **THEN** sign-in fails with "Login timed out."

#### Scenario: Team Admin scopes
- **WHEN** `autodesk.forge.enableTeamAdminApi` is false or unset
- **THEN** Team Admin scopes are not requested

### Requirement: Secure Service Account sign in

The "Secure Service Account" mode SHALL list the application's secure service accounts (progress "Loading secure service accounts..."), then their keys (progress "Loading keys..."), then ask for the private key `.pem` file for the chosen key and a multi-select of scopes. It SHALL then generate a signed assertion and exchange it for a token (progress "Generating access token..."). The session SHALL be labelled `service account: <email>` and SHALL keep the account, key ID, and private key so it can mint new tokens.

#### Scenario: Full flow
- **WHEN** the user selects an account, a key, a private key file, and at least one scope
- **THEN** a session is created for that service account with the selected scopes

#### Scenario: No accounts
- **WHEN** the application has no secure service accounts
- **THEN** sign-in fails with "No secure service accounts found for this application."

#### Scenario: No keys
- **WHEN** the selected account has no keys
- **THEN** sign-in fails with "The selected service account has no keys."

#### Scenario: Cancelling a step
- **WHEN** the user dismisses the account picker, the key picker, the private key file dialog, or the scope picker
- **THEN** sign-in is cancelled without a message

#### Scenario: No scopes selected
- **WHEN** the user confirms the scope picker with no scopes selected
- **THEN** sign-in fails with "No scopes selected."

### Requirement: Pasted token sign in

The "Paste access token" mode SHALL ask for a token in a masked input box and use it as-is, without refresh. The session SHALL be labelled "manual token" and use the requested scopes, or the default scopes if none were requested.

#### Scenario: Token pasted
- **WHEN** the user pastes a token
- **THEN** the session is created and the token is used for user views until it expires or the user signs out

#### Scenario: Empty input
- **WHEN** the user dismisses the input or submits it empty
- **THEN** sign-in is cancelled without a message

### Requirement: Session storage and restore

The session SHALL be stored in VS Code secret storage, one per environment, keyed by the environment's client ID. On startup and after switching environments, the stored session of the active environment SHALL be restored and applied to the user services. The extension SHALL support one account only.

#### Scenario: Window reload
- **WHEN** the window reloads after signing in
- **THEN** the user views load with the restored session without prompting

#### Scenario: Separate environments
- **WHEN** two environments have different client IDs and only one is signed in
- **THEN** the other environment shows the signed-out state

### Requirement: Token refresh

For the OAuth modes, a token SHALL be refreshed with its refresh token when it has less than 60 seconds left, and the new tokens SHALL be stored again. For secure service account sessions, a new token SHALL be minted from the stored key when needed. A pasted token SHALL never be refreshed.

#### Scenario: Token about to expire
- **WHEN** a user view makes a request and the access token expires within 60 seconds
- **THEN** the token is refreshed first and the new material is saved to secret storage

### Requirement: Sign out

`aps.auth.logout` ("Logout") SHALL remove the stored session of the active environment after the user confirms a "Yes"/"No" quick pick ("Would you like to sign out?"). It SHALL also appear as a navigation button in the title bar of each user view while signed in. The session SHALL also be removable from the VS Code Accounts menu. After removal, the services SHALL be rebuilt without a user session and the user views SHALL return to their sign-in messages.

#### Scenario: Confirmed
- **WHEN** the user answers "Yes"
- **THEN** the session is deleted and the message "You are now signed out..." is shown

#### Scenario: Declined or dismissed
- **WHEN** the user answers "No" or dismisses the picker
- **THEN** the session is kept

#### Scenario: Not signed in
- **WHEN** the user runs `aps.auth.logout` with no session
- **THEN** the message "You are not signed in." is shown

### Requirement: Generate access token

`aps.auth.getAccessToken` ("Generate Access Token") SHALL let the user multi-select scopes from the default scope list (placeholder "Select scopes for the access token"), then generate a 2-legged token for the active environment (progress "Generating access token..."). It SHALL show "Access token generated (expires in: <n> seconds)" with a "Copy Token to Clipboard" action that copies the token.

#### Scenario: Copying the token
- **WHEN** the user selects "Copy Token to Clipboard"
- **THEN** the token is copied to the clipboard

#### Scenario: Cancelling scope selection
- **WHEN** the user dismisses the scope picker
- **THEN** no token is generated

#### Scenario: Token request fails
- **WHEN** token generation fails
- **THEN** an error message titled "Could not generate access token" is shown
