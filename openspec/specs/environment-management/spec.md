# Environment management

## Purpose

Configure and switch between APS environments. An environment bundles an APS application's credentials and endpoints (title, client ID, client secret, region, host, Design Automation region and endpoint) and is stored in the `autodesk.forge.environments` setting. Exactly one environment is active at a time; every view and command talks to APS through it.

Out of scope: sign-in and session handling (see `authentication`).

## Requirements

### Requirement: Environments setting

Environments SHALL be read from the `autodesk.forge.environments` setting, an array of objects with `title`, `clientId`, `clientSecret`, `host`, `region`, `designAutomationRegion`, and `designAutomationEndpoint`. The `region` value SHALL be one of `US`, `EMEA`, `AUS`, `CAN`, `DEU`, `IND`, `JPN`, or `GBR`. The environment's `host`, `region`, `designAutomationRegion`, and `designAutomationEndpoint` SHALL be applied to the APS clients built for it.

#### Scenario: Environments are configured
- **WHEN** the extension activates and the setting contains one or more environments
- **THEN** one environment becomes active and all views are created for it

#### Scenario: Setting is missing or empty
- **WHEN** `autodesk.forge.environments` is unset or an empty array
- **THEN** the setup wizard is offered instead of the normal extension startup

### Requirement: Active environment on startup

On startup the extension SHALL activate the environment last selected in the current workspace, if it is still configured (matched by `title`). Otherwise it SHALL activate the first environment in the setting.

#### Scenario: Returning to a workspace
- **WHEN** the user previously switched to environment "Staging" in this workspace and it is still configured
- **THEN** "Staging" is active on the next startup

#### Scenario: Remembered environment was removed
- **WHEN** the remembered environment title no longer exists in the setting
- **THEN** the first configured environment is activated

#### Scenario: Nothing remembered
- **WHEN** no environment was ever selected in this workspace
- **THEN** the first configured environment is activated

### Requirement: First-run setup wizard

When no environment is configured, the extension SHALL show an information message saying that APS application credentials are missing, with an "Enter APS Credentials" action. Choosing it SHALL prompt, in order, for the client ID, the client secret, the region (a quick pick of `US`, `EMEA`, `AUS`, `CAN`, `DEU`, `IND`, `JPN`, `GBR`), and an environment name. The result SHALL be saved as the only entry of `autodesk.forge.environments` in user settings, after which the window SHALL be reloaded. While no environment is configured, no APS views or commands are registered.

#### Scenario: Wizard completed
- **WHEN** the user enters all four values
- **THEN** a single environment with that title, client ID, client secret, and region is written to the user-level `autodesk.forge.environments` setting and the window reloads

#### Scenario: Message dismissed
- **WHEN** the user dismisses the message without choosing the action
- **THEN** nothing is saved and the extension stays inactive for this session

#### Scenario: Cancelled at any prompt
- **WHEN** the user cancels or leaves empty the client ID, client secret, region, or name prompt
- **THEN** the wizard stops, nothing is saved, and the window is not reloaded

#### Scenario: Saving fails
- **WHEN** an error occurs during the wizard
- **THEN** an error message "Could not setup APS environment: <error>" is shown

### Requirement: Active environment indicator

A status bar item on the left SHALL show `APS Env: <title>` for the active environment. Selecting it SHALL run `aps.switchEnvironment`. The text SHALL update whenever the active environment changes.

#### Scenario: Clicking the status bar item
- **WHEN** the user selects the status bar item
- **THEN** the environment picker opens

### Requirement: Switching environments

`aps.switchEnvironment` (titled "Switch Environment" in the Command Palette) SHALL show a quick pick, with the placeholder "Select APS environment", listing the titles of all configured environments, with the active environment first. Choosing an environment SHALL make it active, remember it for the current workspace, rebuild all APS services for it, restore that environment's stored user session if one exists, refresh every view, and update the status bar item.

#### Scenario: Switching to another environment
- **WHEN** the user picks a different environment
- **THEN** all views reload using that environment's credentials, region, and host, and the status bar shows its title

#### Scenario: Session follows the environment
- **WHEN** the user switches to an environment that has a stored sign-in
- **THEN** the user (3-legged) views are available without signing in again

#### Scenario: No stored session
- **WHEN** the user switches to an environment with no stored sign-in
- **THEN** the user views prompt for sign-in and the app (2-legged) views work immediately

#### Scenario: Choosing the active environment
- **WHEN** the user picks the environment that is already active
- **THEN** services and views are rebuilt for it and the selection is remembered, with no other visible change

#### Scenario: Cancelling the picker
- **WHEN** the user dismisses the quick pick
- **THEN** the active environment is unchanged and nothing is refreshed

### Requirement: Reacting to settings edits

Any change to a setting under `autodesk.forge` SHALL update the viewer preview settings. A change to `autodesk.forge.environments` SHALL rebuild services and refresh all views and the status bar item without reloading the window.

#### Scenario: Active environment still exists
- **WHEN** the setting changes and an environment with the active title still exists
- **THEN** that environment stays active, using its updated values

#### Scenario: Active environment removed or renamed
- **WHEN** the setting changes and no environment has the active title
- **THEN** the remembered or first configured environment becomes active

#### Scenario: All environments removed
- **WHEN** the setting becomes empty
- **THEN** the current environment stays active until a new one is configured
