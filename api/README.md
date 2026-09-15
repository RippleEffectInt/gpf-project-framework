# API extension point

Azure Functions for SharePoint data access belong in this folder. Production
builds call the typed `/api/projects` contract through
`SharePointProjectRepository`. `functions/projects.ts` registers the HTTP
endpoints included in the Static Web Apps `api` deployment. Certificate and
SharePoint resource settings are Function app settings, never Vite variables.

The required endpoints, SharePoint fields, ETag behavior, permissions,
environment settings and manual setup steps are documented in
`../docs/sharepoint-persistence-setup.md`.

SharePoint access must be implemented here and never in browser code.
Every endpoint must reject requests without a verified Azure Static Web Apps
principal and make authorization decisions server-side. Human audit fields
must be derived from that principal: browser-supplied creator or modifier
identity is never trusted.

`projectAuditPolicy.ts` provides the shared create/update audit-field policy
for the future endpoints, including verified Entra principal enforcement,
creator preservation and current-modifier derivation.

`sharePointProjectStorage.ts` defines the server-side list fields,
document-library reference, stable filename convention and dual-resource ETag
contract. `ProjectRecord.etag` remains opaque to the browser and represents
both SharePoint ETags.

The same service defines file-first update recovery, typed metadata-sync
retries that do not rewrite JSON, idempotent create/orphan handling and a
reconciliation method that rebuilds list metadata from authoritative
`PersistedProjectDesignV1` content.

`sharePointProjectSchema.ts` is the only source for the confirmed site URL,
resource display names and Graph internal field names. It serializes and
deserializes list/library metadata and reads the site, Project Designs list and
library-list identifiers from server configuration.

`sharePointProjectDriveResolver.ts` resolves the library's Graph drive through
`/sites/{site-id}/lists/{library-list-id}/drive` and caches successful
resolution for the Function-process lifetime. Browser code never receives or
configures this drive ID.

`graphCertificateAuth.ts` owns server-only password-protected PFX parsing,
in-memory RSA PKCS#8 PEM conversion, the MSAL confidential client and cached
application-token acquisition.
`microsoftGraphClient.ts` is the only Graph HTTP authentication boundary and
distinguishes Graph 401, 403 and data failures.
`sharePointGraphServices.ts` constructs shared process-level configuration,
token, Graph client and drive-resolution services for storage gateways.

Secrets, tenant settings and certificate material must be supplied through
secure deployment configuration and must not be committed.
