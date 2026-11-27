# Read-only content viewer

## Purpose

Show details, reports, and generated secrets in read-only editor tabs. Commands such as "view details" for buckets, objects, manifests, webhooks, issues, hubs, secure service accounts, and others open their result in a virtual document instead of a temporary file or an "Untitled" buffer.

Out of scope: the content of each specific command, which belongs to the capability that owns it.

## Requirements

### Requirement: Virtual read-only documents

Details SHALL open in a virtual document with the `aps-readonly` URI scheme. The document SHALL be held in memory, SHALL NOT be editable, and SHALL NOT create a file on disk. Each document SHALL open in a regular (non-preview) editor tab.

#### Scenario: Viewing details
- **WHEN** the user runs a "view details" command, for example `aps.oss.viewBucketDetails`
- **THEN** a new read-only editor tab opens with the details

#### Scenario: Edit attempt
- **WHEN** the user tries to type in the tab
- **THEN** the edit is refused because the document is read-only

### Requirement: Content formats

Structured data SHALL be shown as JSON pretty-printed with four-space indentation, in a document whose name ends in `.json`. Plain text, such as generated assertions, private keys, and work item reports, SHALL be shown verbatim in a document whose name ends in `.txt`.

#### Scenario: Structured data
- **WHEN** a command shows an object such as a manifest
- **THEN** the tab shows it as indented JSON with JSON syntax highlighting

#### Scenario: Plain text
- **WHEN** a command shows a text result such as a Design Automation work item report
- **THEN** the tab shows the text unchanged with a `.txt` name

### Requirement: Stable document identity

Each resource SHALL map to a stable URI built from the command's path segments (each segment URI-encoded) with the extension appended to the last segment. Running the same command for the same resource SHALL reopen that same document rather than creating another one.

#### Scenario: Reopening the same resource
- **WHEN** the user views the details of the same bucket twice
- **THEN** a single tab exists, and it is brought to the front

#### Scenario: Different resources
- **WHEN** the user views the details of two different buckets
- **THEN** each opens in its own tab

#### Scenario: Special characters in identifiers
- **WHEN** a resource identifier contains characters such as `/` or `:`
- **THEN** the identifier is encoded so it stays a single path segment of the document URI

### Requirement: Refresh on reopen

When a document is opened again, its content SHALL be replaced with the latest data. If the document is already open, the open tab SHALL update in place.

#### Scenario: Data changed on the server
- **WHEN** the user refreshes a resource's details after it changed and runs the view command again
- **THEN** the existing tab shows the new content

### Requirement: Content lifetime

Content SHALL be kept in memory only for the current session. A document URI with no stored content, for example one restored after the window reloads, SHALL be shown empty.

#### Scenario: Window reloaded
- **WHEN** the window reloads with a read-only tab open
- **THEN** the restored tab is empty until the command is run again
