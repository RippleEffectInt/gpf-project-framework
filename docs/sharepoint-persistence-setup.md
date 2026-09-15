# SharePoint project persistence setup

The SharePoint site, list and document library now exist. This implementation
update did not modify those resources and made no Entra or permission changes.
The remaining IDs and settings below are required before API deployment.

## Persisted JSON schema

`PersistedProjectDesignV1` is defined in `src/persistence/types.ts`.

```json
{
  "schemaVersion": 1,
  "frameworkVersion": "PF-1.0-NORMALIZED-PR1",
  "frameworkSchemaVersion": "1.2",
  "project": {
    "id": "stable-project-id",
    "name": "Project name",
    "country": "Optional country",
    "projectCode": "Optional project code",
    "status": "Draft"
  },
  "design": {
    "metadata": {
      "donor": "",
      "fundingReference": "",
      "projectManager": "",
      "plannedStartDate": "YYYY-MM",
      "plannedEndDate": "YYYY-MM",
      "description": ""
    },
    "selectedFinalOutcomeIds": [],
    "finalOutcomeSelectionSources": {},
    "projectPathways": [],
    "outcomePathwayLinks": [],
    "customInnovation": null
  }
}
```

The nested pathway, Intermediate Outcome configuration and Custom Innovation
contracts are explicit typed V1 records. Standard framework content is
represented by stable IDs. Custom Innovation content is project-owned and is
stored in full.

The payload does not contain UI state, validation messages, basket state,
graph nodes, graph coordinates, zoom/pan state or rendered Theory of Change
data. `lastSavedAt` is record metadata, not authoritative design data.

### Data authority

The `PersistedProjectDesignV1` document-library JSON file is the authoritative
project-design record. Project Designs list columns are a searchable query and
index projection only. When they disagree, opening a project uses the JSON for
project content and the API schedules or performs metadata reconciliation. It
must never rebuild or overwrite authoritative JSON from stale list fields.

## Confirmed SharePoint resources

Site: `https://sendacow.sharepoint.com/sites/Projects`

List display name: **GPF - Project Designs**

| Display name             | Internal field name    | SharePoint type          | Required | Notes                                                                                                  |
| ------------------------ | ---------------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| Project Name             | `Title`                | Single line of text      | Yes      | Built-in Title field                                                                                   |
| Project ID               | `field_1`              | Single line of text      | Yes      | Indexed; enforce unique values                                                                         |
| Project Code             | `field_2`              | Single line of text      | No       | Indexed if portfolio filtering needs it                                                                |
| Country                  | `field_3`              | Single line of text      | No       |                                                                                                        |
| Project Status           | `field_4`              | Choice                   | Yes      | Draft, Submitted, Changes Requested, Approved; default Draft. No workflow is implemented in this phase |
| Framework Version        | `field_5`              | Single line of text      | Yes      | Indexed                                                                                                |
| Framework Schema Version | `field_6`              | Single line of text      | Yes      |                                                                                                        |
| Project Schema Version   | `ProjectSchemaVersion` | Number, 0 decimal places | Yes      | Indexed                                                                                                |
| Project Design File ID   | `field_8`              | Single line of text      | Yes      | Stable Graph drive-item ID for the authoritative JSON file                                             |
| Created By Name          | `field_9`              | Single line of text      | Yes      | Derived by the API from the authenticated human principal                                              |
| Created By Email         | `field_10`             | Single line of text      | Yes      | Derived by the API; never accepted from the project request body                                       |
| Created By Object ID     | `field_11`             | Single line of text      | Yes      | Verified Entra object ID; indexed                                                                      |
| Modified By Name         | `field_12`             | Single line of text      | Yes      | Derived by the API from the current authenticated human principal                                      |
| Modified By Email        | `field_13`             | Single line of text      | Yes      | Derived by the API; never accepted from the project request body                                       |
| Modified By Object ID    | `field_14`             | Single line of text      | Yes      | Verified Entra object ID; indexed                                                                      |
| Created                  | `Created`              | Date and Time            | Native   | Built-in system field                                                                                  |
| Created By               | `Author`               | Person or Group          | Native   | Built-in system field                                                                                  |
| Modified                 | `Modified`             | Date and Time            | Native   | Built-in system field                                                                                  |
| Modified By              | `Editor`               | Person or Group          | Native   | Built-in system field                                                                                  |

No project-design JSON is stored in a list text column. The repository exposes
one opaque concurrency token that represents both the metadata list-item ETag
and the design-file ETag; no duplicate version column is proposed. List version
history should be enabled.

With certificate-based application access, native `Author` and `Editor`
identify the application/service principal rather than the human user. The
six application audit columns preserve the verified human identity alongside
those native fields. Users do not type these values, and the API never trusts
audit values supplied by the browser.

### Document library

Display name: **GPF - Project Design Files**

Confirmed internal field names:

| Display name             | Internal field name      |
| ------------------------ | ------------------------ |
| Project ID               | `ProjectId`              |
| Framework Version        | `FrameworkVersion`       |
| Framework Schema Version | `FrameworkSchemaVersion` |
| Project Schema Version   | `ProjectSchemaVersion`   |
| Created By               | `Author`                 |
| Created                  | `Created`                |
| Modified                 | `Modified`               |
| Modified By              | `Editor`                 |

- Store one authoritative JSON document per persisted project.
- Store files under the `designs` folder.
- Filename: `ProjectDesign-<ProjectId>.json`.
- Use the stable `ProjectId`, never the editable project title.
- File content remains exactly `PersistedProjectDesignV1`.
- Store the Graph drive-item ID in `ProjectDesignFileId`.
- Resolve the current file URL through Graph rather than making a mutable URL
  authoritative.
- Enable major document version history.
- Restrict users from bypassing the application to edit JSON files directly,
  subject to organisational governance.

Example path:

```text
GPF - Project Design Files/designs/ProjectDesign-550e8400-e29b-41d4-a716-446655440000.json
```

## Browser-to-SharePoint architecture

```text
Typed React project state
        |
serializeProject / loadPersistedProject
        |
ProjectRepository
        |-- LocalProjectRepository (localStorage, development/tests)
        `-- SharePointProjectRepository (relative /api/projects HTTP contract)
                    |
              Azure Functions
                    |
              Microsoft Graph
             /             \
GPF - Project Designs list   GPF - Project Design Files library
```

The browser never receives SharePoint tenant IDs, list IDs, certificates or
Graph credentials.

## `/api/projects` contract

- `GET /api/projects` returns `ProjectSummary[]`, ordered by Modified
  descending.
- `GET /api/projects/{projectId}` returns a `ProjectRecord` and its ETag.
- `POST /api/projects` accepts `PersistedProjectDesignV1` and returns the
  created `ProjectRecord`. The API creates the design file first and then the
  metadata item containing its drive-item ID.
- `PUT /api/projects/{projectId}` accepts `PersistedProjectDesignV1`, requires
  the opaque combined `If-Match` token, and returns the updated
  `ProjectRecord`.
- `POST /api/projects/{projectId}/metadata-sync` accepts only an opaque
  metadata-sync token and retries the list projection update without writing
  the JSON file.
- HTTP 401, 403, 404, 409/412 and network failures are mapped to typed,
  user-safe errors.

The Function must derive audit identity from its authenticated principal,
validate schema/version and field lengths again, query by indexed `ProjectId`,
retrieve the referenced drive item, and pass the relevant SharePoint ETags
during updates.

### Create, load and update storage flow

Create:

1. Validate `PersistedProjectDesignV1`.
2. Create `designs/ProjectDesign-<ProjectId>.json` with that JSON content.
3. Create the Project Designs list item with `ProjectDesignFileId` and the
   queryable metadata/audit fields.
4. If metadata creation fails, check whether an equivalent item was committed
   despite an ambiguous network response.
5. If no item exists, attempt to remove the newly created orphan file.
6. If cleanup succeeds, fail the create and retain the user's local design.
7. If cleanup fails, return and log a typed `orphan-storage` condition including
   the stable ProjectId and drive-item ID for administrative reconciliation.

Create is idempotent by indexed, unique `ProjectId` and deterministic file
path. Before creating either resource, the API checks for an existing list
item and `designs/ProjectDesign-<ProjectId>.json`. A retry returns the completed
aggregate or links a pre-existing orphan file; it does not create duplicate
files or list items. The Graph file-create call must use fail-on-conflict
semantics rather than automatic filename renaming.

Load:

1. Query the indexed Project Designs list item by `ProjectId`.
2. Read its `ProjectDesignFileId`.
3. Retrieve the JSON file through Graph.
4. Parse and validate it through the existing persisted-schema boundary.
5. Compare its exact framework and framework-schema versions with an available
   framework dataset before returning editable domain state.

Update:

1. Decode the opaque repository token into the metadata and design-file ETags.
2. Re-read both resources and require both ETags to match.
3. Update the JSON file with its file ETag in `If-Match`. A newer file produces
   a conflict; it is never silently overwritten. If this step fails, metadata
   is untouched and browser edits remain local.
4. Update list metadata and human audit fields using the metadata item ETag.
5. If both writes succeed, return a normal saved result and a new opaque token
   containing both new ETags.
6. If the file succeeds but metadata fails, return a typed
   `metadata-sync-required` partial-save result. Its `record` represents the
   saved authoritative JSON, and its opaque metadata-sync token retains the
   target projection, drive-item ID, file ETag and metadata item identity
   needed for a safe retry.

The metadata-sync token must be integrity-protected by the API (for example,
signed and time-limited) or represented by a server-side recovery record. The
API must not trust browser-modified projection or audit values.

SharePoint does not provide an atomic transaction spanning a list item and a
document-library file. The JSON file is authoritative. A partial-save response
must say that the project design was saved and only its project-list
information still needs synchronising; it must not describe the design as
unsaved. The browser offers **Retry metadata sync**. That action revalidates the
saved file ID and ETag, updates only the list item with its current ETag, and
never rewrites the JSON file. File and list version history provide recovery
evidence. The API must never retry a failed ETag comparison as an unconditional
overwrite.

### Reconciliation capability

The reusable server storage service exposes reconciliation by stable
`ProjectId`. It reads and validates the authoritative JSON, derives all
project-list fields from it, preserves/derives audit fields under the existing
server policy, and creates or conditionally updates the metadata item. It
never writes the JSON document. This is a callable backend capability for
endpoint, scheduled-job or future admin tooling use; no admin UI is included
in this phase.

### Historical framework availability

Exact `frameworkVersion` and `frameworkSchemaVersion` matching remains
mandatory. Every framework dataset referenced by a persisted project must
therefore remain available as an immutable historical application dataset (or
through a future approved framework snapshot repository). Removing or replacing
an older dataset makes its projects intentionally unavailable for editing until
that exact dataset is restored. The application must not reinterpret those
projects with the current framework or loosen the compatibility rule.

### Human audit write rules

The request DTO remains only `PersistedProjectDesignV1`; it contains no audit
identity fields.

On create, the Function must:

1. Reject the request with HTTP 401 when there is no verified SWA principal.
2. Derive name, email and Entra object ID from that verified principal.
3. Populate all `CreatedBy*` and `ModifiedBy*` fields with those values.
4. Ignore or reject any audit-like properties added to the browser body.

On update, the Function must:

1. Load the existing SharePoint item.
2. Preserve all existing `CreatedBy*` values unchanged.
3. Derive the current human identity again from the verified principal.
4. Replace only the `ModifiedBy*` values.
5. Apply the list update with the metadata ETag from the submitted opaque
   `If-Match` token.

For Entra-backed SWA identity, `clientPrincipal.userId` is the proposed object
ID source. Name and email come from verified `name`, `email`,
`preferred_username` or equivalent Entra claims. The API must reject the
operation if it cannot derive the required identity values safely.

## Configuration

Browser-safe Vite values (build-time only; never Azure Function settings):

```text
VITE_PROJECT_REPOSITORY=local|sharepoint
VITE_PROJECT_API_BASE_URL=/api/projects
```

`VITE_PROJECT_REPOSITORY` cannot change production. Production client builds
always instantiate `SharePointProjectRepository` via a compile-time Vite
`command === 'build'` define (`__GPF_CLIENT_REPOSITORY_MODE__`), so
`LocalProjectRepository` is eliminated from the shipped JavaScript. Do not
branch on `import.meta.env.PROD` for this choice: Vite 7 sets `PROD` from
`NODE_ENV === "production"`, which is often false during CI `vite build`.
Local development keeps `local` unless this value is set to `sharepoint`.
The GitHub Actions workflow must not and does not set this variable. Putting
`VITE_*` values in Azure App Settings cannot change the already-built
frontend.

Required server-side Azure Function settings (names proposed for review):

```text
SHAREPOINT_SITE_URL=https://sendacow.sharepoint.com/sites/Projects
SHAREPOINT_SITE_ID=sendacow.sharepoint.com,8a1523a5-679f-44df-ba39-a169cbef9e44,37826090-209d-4477-9654-5a3edd5fbba0
SHAREPOINT_PROJECT_DESIGNS_LIST_ID=aa3d80ac-739f-48a5-8f0c-d812b0942872
SHAREPOINT_PROJECT_DESIGN_FILES_LIBRARY_LIST_ID=733df8ae-d910-4c5e-8e34-f4189ba7537d
SHAREPOINT_TENANT_ID
SHAREPOINT_CLIENT_ID
SHAREPOINT_CERTIFICATE_THUMBPRINT=35368FD73B7C981AFE8382FCCA09070F8758FFE0
SHAREPOINT_CERTIFICATE_PFX_BASE64
SHAREPOINT_CERTIFICATE_PFX_PASSWORD
```

None of the server settings may use the `VITE_` prefix. Confirmed non-secret
resource identifiers may appear in `.env.example`; credentials, certificates
and secret values must never be committed.

### Backend certificate authentication

`SHAREPOINT_CERTIFICATE_PFX_BASE64` contains the complete password-protected
PFX/PKCS#12 binary file encoded as standard base64 on one line.
`SHAREPOINT_CERTIFICATE_PFX_PASSWORD` contains its password exactly, without
trimming.

The backend uses `node-forge` to parse and decrypt the PKCS#12 data server-side,
find its RSA private-key bag, and convert that key in memory to unencrypted
PKCS#8 PEM with `BEGIN PRIVATE KEY` markers. It normalizes PEM CRLF/LF and
validates the extracted RSA key with Node's cryptographic key parser. Neither
the PFX nor extracted PEM is written to disk.

One process-level `@azure/msal-node` `ConfidentialClientApplication` receives:

```text
authority = https://login.microsoftonline.com/<SHAREPOINT_TENANT_ID>
clientId = SHAREPOINT_CLIENT_ID
clientCertificate.thumbprint = SHAREPOINT_CERTIFICATE_THUMBPRINT
clientCertificate.privateKey = decoded and normalized PEM
```

`@azure/msal-node` 6 requires the deployed Azure Functions runtime to use
Node.js 20 or newer.

There is no client secret. The previous
`SHAREPOINT_CERTIFICATE_PRIVATE_KEY_BASE64`,
`SHAREPOINT_CERTIFICATE_BASE64` and `SHAREPOINT_CERTIFICATE_PASSWORD` names are
not supported.

The shared token provider calls `acquireTokenByClientCredential` with
`https://graph.microsoft.com/.default`. It reuses the MSAL client, caches a
valid application token until its refresh window and shares concurrent token
requests. PFX content, PFX passwords, extracted private keys, access tokens,
raw MSAL failures and complete credential configuration are never logged or
returned to React.

All backend Graph requests use the shared authenticated Graph client. Graph
401 and 403 responses are represented by distinct safe authentication and
permission errors; other HTTP failures remain SharePoint/Graph data errors.

### Graph drive resolution

The drive ID is not a manual setting. At Function startup or first file
operation, the backend requests:

```text
GET /sites/{SHAREPOINT_SITE_ID}/lists/{SHAREPOINT_PROJECT_DESIGN_FILES_LIBRARY_LIST_ID}/drive?$select=id,sharepointIds
```

It validates any returned `sharepointIds.listId` against the configured
library list GUID and caches the successful drive ID for the lifetime of that
Function process. Concurrent callers share the in-flight lookup. Failed
lookups return a typed drive-resolution failure and are not cached, allowing a
later invocation to retry. The resolved drive ID and all tenant identifiers
remain behind `/api/projects` and are never returned to React.

## Authentication and permissions

Proposed first production approach, consistent with the existing `/api`
boundary:

1. Azure Static Web Apps authenticates users with Entra ID.
2. `staticwebapp.config.json` restricts `/api/projects` and
   `/api/projects/*` to the built-in `authenticated` role.
3. Every Function endpoint independently rejects a missing/invalid verified
   principal with HTTP 401. This check must not rely on React route or button
   visibility.
4. Project visibility and operation authorization are decided by the
   server-side API before SharePoint is queried or changed. No browser-supplied
   identity or authorization decision is trusted.
5. A separate Function app registration uses certificate credentials to call
   Microsoft Graph.
6. Grant that app Microsoft Graph **Sites.Selected** as an **Application**
   permission, with admin consent.
7. A SharePoint/Graph administrator grants the app **write** access only to the
   selected site. Do not grant tenant-wide `Sites.ReadWrite.All` unless
   organisational review explicitly approves it.

No additional Microsoft Graph permission scope is required for the document
library. The existing **Sites.Selected** Application permission plus the
site-specific **write** grant covers both list items and files within that
approved site. `Files.ReadWrite.All` is not proposed.

The phase-one server authorization policy permits verified Entra-authenticated
application users to list, read, create and update projects. That baseline
decision is represented by `api/projectAuditPolicy.ts` and must be invoked by
every endpoint. Project ownership, role-based editing and advanced permissions
remain explicitly deferred rather than being simulated in React.

The SWA Entra registration needs redirect URIs for each deployed environment:

```text
https://<static-web-app-host>/.auth/login/aad/callback
```

Local development continues to use the existing mock identity and local
repository. No delegated Graph permission is required by the browser in the
app-only design.

## Remaining setup and confirmation

SharePoint identifiers, certificate authentication, `/api/projects` Functions
and production frontend SharePoint selection are implemented in this
repository. Production Azure Function settings for the certificate and
resource IDs are configured outside this codebase.

Still required before a real persistence test:

1. Confirm GitHub Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_WAVE_021AD9203` and deploy from `main`.
2. Confirm Azure Static Web Apps Entra authentication and
   `https://<static-web-app-host>/.auth/login/aad/callback`.
3. Confirm Microsoft Graph **Sites.Selected** Application permission, admin
   consent, and site-specific write access for the backend app.
4. Confirm `field_1` (ProjectId) is indexed and unique, `field_4` choices
   match documented statuses, list/library version history is enabled, and the
   `designs` folder exists.
5. After deploy, verify authenticated `/api/projects` against SharePoint, plus
   unauthenticated 401, ETag conflicts and metadata-sync recovery.
