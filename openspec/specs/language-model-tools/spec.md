# Language model tools

## Purpose

Expose APS operations to the VS Code chat agent mode as eight language model tools, all prefixed `aps_`: `aps_listBuckets`, `aps_createBucket`, `aps_listObjects`, `aps_uploadFile`, `aps_translateObject`, `aps_getTranslationStatus`, `aps_listWebhookEvents`, and `aps_createWebhook`. The tools act on the active environment, can be referenced in a chat prompt, and return their results to the model as text (strings as-is, everything else as indented JSON).

Out of scope: the equivalent tree views and commands (see `object-storage`, `model-derivative-translation`, and `webhooks`), and the sign-in flow itself.

## Requirements

### Requirement: Tool registration

The extension SHALL register exactly the eight tools listed in Purpose when it activates, and each SHALL be declared in `contributes.languageModelTools` with the same name, a model description, and an input schema that matches the tool's inputs. Each tool SHALL be referenceable in a chat prompt (`canBeReferencedInPrompt`) under its `toolReferenceName`.

#### Scenario: Registered tools match the contributed tools
- **WHEN** the extension has activated
- **THEN** the set of registered `aps_*` tools equals the set of tools contributed in `package.json`

### Requirement: Confirmation for tools with side effects

The tools that create or change resources, `aps_createBucket`, `aps_uploadFile`, `aps_translateObject`, and `aps_createWebhook`, SHALL ask the user to confirm before running. The confirmation SHALL show the action title, the key inputs, and the title of the active environment. The read-only tools (`aps_listBuckets`, `aps_listObjects`, `aps_getTranslationStatus`, and `aps_listWebhookEvents`) SHALL run without a confirmation and SHALL only show a progress message.

#### Scenario: Creating a bucket asks for confirmation
- **WHEN** the model invokes `aps_createBucket` with a bucket key and no policy
- **THEN** a "Create APS bucket" confirmation names the bucket, the retention policy `transient`, and the active environment

#### Scenario: Uploading a file asks for confirmation
- **WHEN** the model invokes `aps_uploadFile` without an object key
- **THEN** an "Upload file to APS bucket" confirmation shows the file path, the bucket, and the file's base name as the object key

#### Scenario: Translating an object warns about replacement
- **WHEN** the model invokes `aps_translateObject`
- **THEN** a "Translate APS object" confirmation states that an SVF2 translation will start and that existing derivatives will be replaced

#### Scenario: Creating a webhook shows the auth context
- **WHEN** the model invokes `aps_createWebhook`
- **THEN** a "Create APS webhook" confirmation shows the event, system, callback URL, and whether the webhook uses the `user` or the `app` context (anything other than `user` is shown as `app`)

#### Scenario: Read-only tools do not ask
- **WHEN** the model invokes `aps_listBuckets`
- **THEN** only the message "Listing APS buckets" is shown and the tool runs without confirmation

### Requirement: List buckets

`aps_listBuckets` SHALL take no input and SHALL return all buckets owned by the application in the active environment's region, fetching every page. Each bucket SHALL be reported with `bucketKey`, `policyKey`, and `createdDate`.

#### Scenario: Buckets exist
- **WHEN** the model invokes `aps_listBuckets`
- **THEN** the result is a JSON array of `{ bucketKey, policyKey, createdDate }` for every bucket in the region

#### Scenario: No buckets
- **WHEN** the application owns no buckets
- **THEN** the result is an empty JSON array

#### Scenario: Listing fails
- **WHEN** the underlying request fails
- **THEN** the tool call fails with the error and no result is returned

### Requirement: Create bucket

`aps_createBucket` SHALL take a required `bucketKey` and an optional `policyKey` (`transient`, `temporary`, or `persistent`; default `transient`). It SHALL create the bucket in the active environment's region, refresh the object storage view, and return the created bucket.

#### Scenario: Default retention policy
- **WHEN** the model invokes `aps_createBucket` with only `bucketKey`
- **THEN** a `transient` bucket is created in the environment's region and the object storage view is refreshed

#### Scenario: Unknown retention policy
- **WHEN** `policyKey` is not one of `transient`, `temporary`, or `persistent`
- **THEN** the tool fails with "Unknown retention policy" listing the valid values, and no bucket is created

#### Scenario: Creation is rejected by APS
- **WHEN** APS rejects the request (for example, the key is already taken)
- **THEN** the tool call fails with the error and the object storage view is not refreshed

### Requirement: List objects

`aps_listObjects` SHALL take a required `bucketKey` and SHALL return all objects in the bucket, fetching every page. Each object SHALL be reported with `objectKey`, `objectId`, and `size`.

#### Scenario: Bucket has objects
- **WHEN** the model invokes `aps_listObjects` with an existing bucket key
- **THEN** the result is a JSON array of `{ objectKey, objectId, size }` for every object

#### Scenario: Empty bucket
- **WHEN** the bucket contains no objects
- **THEN** the result is an empty JSON array

#### Scenario: Bucket does not exist
- **WHEN** the bucket key is unknown or inaccessible
- **THEN** the tool call fails with the error from APS

### Requirement: Upload file

`aps_uploadFile` SHALL take a required `bucketKey` and `filePath`, and an optional `objectKey`. The object key SHALL default to the file's base name. After a successful upload it SHALL refresh the object storage view and return the uploaded object.

#### Scenario: Absolute path
- **WHEN** `filePath` is absolute
- **THEN** that file is uploaded as given

#### Scenario: Workspace-relative path
- **WHEN** `filePath` is relative and a workspace folder is open
- **THEN** it is resolved against the first workspace folder before uploading

#### Scenario: Relative path without a workspace
- **WHEN** `filePath` is relative and no workspace folder is open
- **THEN** the tool fails with a message asking for an absolute path, and nothing is uploaded

#### Scenario: Custom object key
- **WHEN** `objectKey` is provided
- **THEN** the object is stored under that key instead of the file's base name

#### Scenario: Path is a directory
- **WHEN** `filePath` resolves to a directory
- **THEN** the tool fails with a message that only individual files can be uploaded, and nothing is uploaded

#### Scenario: File does not exist
- **WHEN** `filePath` resolves to a missing file
- **THEN** the tool call fails with the file system error and nothing is uploaded

### Requirement: Translate object

`aps_translateObject` SHALL take a required `bucketKey` and `objectKey` and SHALL start an SVF2 translation of the object through the Model Derivative service, replacing any existing derivatives. On success it SHALL refresh the object storage view and return `{ urn, status: "Translation started" }`. It SHALL NOT wait for the translation to finish.

#### Scenario: Translation starts
- **WHEN** the object exists and SVF2 is among its supported output formats
- **THEN** the translation is started and the result contains the object's URN and the status `Translation started`

#### Scenario: Format not supported
- **WHEN** SVF2 is not among the supported output formats for the object
- **THEN** the tool fails with "The Model Derivative service does not support translating" the object to SVF2, and no translation is started

#### Scenario: Object does not exist
- **WHEN** the bucket or object cannot be found
- **THEN** the tool call fails with the error from APS

### Requirement: Get translation status

`aps_getTranslationStatus` SHALL take a required `bucketKey` and `objectKey` and SHALL return the object's manifest summary: `urn`, `status`, `progress`, and a `derivatives` array of `{ outputType, status, progress }`.

#### Scenario: Translation in progress or finished
- **WHEN** the object has a manifest
- **THEN** the result contains `urn`, `status`, `progress`, and one entry per derivative

#### Scenario: Manifest has no derivatives
- **WHEN** the manifest contains no derivatives
- **THEN** `derivatives` is an empty array

#### Scenario: Object not translated yet
- **WHEN** the object has no manifest
- **THEN** the tool call fails with the error from APS

### Requirement: List webhook events

`aps_listWebhookEvents` SHALL take an optional `system` and SHALL return the webhook systems with their events and the scopes supported by each event, as `{ system, name, events }` entries. It SHALL work offline from the extension's built-in catalog of systems and events.

#### Scenario: All systems
- **WHEN** `system` is omitted or empty
- **THEN** every system in the catalog is returned

#### Scenario: Single system
- **WHEN** `system` is a known ID such as `derivative`
- **THEN** only that system is returned, including its events such as `extraction.finished`

#### Scenario: Unknown system
- **WHEN** `system` is not in the catalog
- **THEN** the tool fails with "Unknown webhook system" listing the valid system IDs

### Requirement: Create webhook

`aps_createWebhook` SHALL take required `system`, `event`, `callbackUrl`, and `scopeValue`, and optional `scopeKey`, `filter` (a JsonPath expression), and `authContext` (`app` or `user`; default `app`). It SHALL validate the system, event, and scope against the built-in catalog, create the webhook through the matching auth context, refresh the webhooks view, and return a text confirmation naming the event, system, scope, and callback URL. The scope key SHALL default to the first scope supported by the event.

#### Scenario: App-context webhook with default scope
- **WHEN** the model invokes `aps_createWebhook` for `data`/`dm.version.added` without `scopeKey` or `authContext`
- **THEN** a webhook is created with the application's credentials and the scope key `folder`, and the webhooks view is refreshed

#### Scenario: User-context webhook
- **WHEN** `authContext` is `user` and the user is signed in
- **THEN** the webhook is created on behalf of the signed-in user

#### Scenario: User context without a session
- **WHEN** `authContext` is `user` and the user is not signed in
- **THEN** the tool fails with a message that creating a webhook in the user context requires signing in, and no webhook is created

#### Scenario: Unknown system
- **WHEN** `system` is not in the catalog
- **THEN** the tool fails with "Unknown webhook system" and points to `aps_listWebhookEvents`

#### Scenario: Unknown event
- **WHEN** `event` is not an event of the given system
- **THEN** the tool fails with "Unknown event" and points to `aps_listWebhookEvents`

#### Scenario: Unsupported scope
- **WHEN** `scopeKey` is not among the scopes supported by the event
- **THEN** the tool fails with "Unsupported scope" listing the valid scopes, and no webhook is created

#### Scenario: Creation is rejected by APS
- **WHEN** APS rejects the request
- **THEN** the tool call fails with the error and the webhooks view is not refreshed

### Requirement: Error reporting

When a tool cannot complete, it SHALL fail the tool call with a descriptive message rather than returning a partial result, so that the model can report or correct the problem. Input validation (retention policy, directory path, translation format, webhook system, event, and scope) SHALL happen before any request that changes state.

#### Scenario: Validation failure has no side effects
- **WHEN** a tool rejects its input during validation
- **THEN** no resource is created or changed and no view is refreshed

#### Scenario: Cancelled confirmation
- **WHEN** the user declines the confirmation for a tool with side effects
- **THEN** the tool does not run and no resource is created or changed
