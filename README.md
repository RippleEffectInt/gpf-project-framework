# Project Framework

Project Framework is an internal Ripple Effect application for designing
projects against a standardised Monitoring, Evaluation and Learning framework.
The eventual design journey is:

`Final Outcome → Pathway(s) → Intermediate Outcomes → Indicators → Activities → Inputs`

This repository implements the application foundation and a local, in-session
design journey through Intermediate Outcome-level indicators, activities and
inputs. It is not yet a persistence or approval system.

The user-facing design journey is deliberately presented as three clear stages:

1. Choose outcomes and pathways
2. Configure pathways
3. Review project

Final Outcome details, the mandatory Primary indicator and both pathway groups
now appear on one page. Pathway details provide matching top and bottom Add
actions and return users to that Final Outcome after selection. Once every
selected outcome has a Primary pathway, the project-summary basket provides the
validated handoff to the unique-pathway configuration overview.

## Current architecture

- React, strict TypeScript and Vite
- React Router for client-side application pages
- React context and a pure reducer for in-session project-design state
- Typed, read-only local framework reference data
- Azure Static Web Apps route configuration
- An `/api` Azure Functions extension point for future server-side operations
- A development-only mock identity behind an authentication service abstraction

Responsibilities are deliberately separated:

- `src/components` contains reusable user-interface elements.
- `src/pages` composes routed screens.
- `src/services` owns framework queries and authentication boundaries.
- `src/state` owns project transactional state and selection rules.
- `src/theoryOfChange` transforms project state and typed framework reference
  data into a deterministic, rendering-library-independent graph model.
- `src/data` contains immutable framework reference data.
- `src/types` contains framework and project data contracts.
- `api` is reserved for future backend data access and business operations.

Framework data is never mutated by project users. Project selections are a
separate transactional model and currently live only in React memory.

The Theory of Change is generated from current project state rather than stored
as a manually edited diagram. Project design remains the source of truth.
React Flow provides the read-only pan/zoom viewport and Dagre calculates a
deterministic bottom-to-top layout. Primary pathway relationships use solid
edges, while Related relationships use dashed edges. Activities, inputs and
indicators stay out of the default graph and are available through node detail.
Custom Innovation outcomes, pathways and ordered Intermediate Outcomes use the
same graph model with a subtle custom label.

Theory of Change generation does not require SharePoint. A later persistence
layer can reload the same project entities and relationships into project state
and regenerate the same graph without storing graph coordinates.

## Local setup

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Vite prints the local URL when it starts. No SharePoint, Azure or secret
configuration is needed for this phase.

## Quality checks

```bash
npm run test
npm run lint
npm run build
```

Tests cover framework relationship queries, Impact Area filtering, Primary
pathway validation, mandatory indicators, configuration actions and the
many-to-many lifecycle, the staged user journey, autosaved activity notes,
optional Custom Innovation content, the Review Project Design page, and the
objective readiness model. Pathways remain unique in project state, can link
to multiple selected Final Outcomes, and are removed only when their final
project link is removed. A unique pathway appears once in configuration and
Review, with every linked Final Outcome and Primary/Related relationship
retained. The project summary is organised around selected Final Outcomes,
with Related pathways listed under the outcome they reinforce.

## Current scope

Implemented:

- Reusable internal-app header with a clearly labelled logo placeholder
- Mock My Projects landing page with search and status filtering
- Validated project-details form with in-session Save Draft behaviour
- Final Outcome browsing, search and Impact Area filtering
- Combined Final Outcome details, indicator preview and Primary/Related
  pathway choices
- Clear required/complete status for each Final Outcome pathway choice
- Relationship classification comes from the normalized link-level
  `pathwayRelationshipType` field, not a global pathway property
- Objective validation requiring at least one Primary pathway per selected
  Final Outcome; Related pathways alone do not satisfy the rule
- Cross-cutting Community-based extension and peer learning pathway, exposed
  as Related for every other Final Outcome while retaining its existing Primary
  relationship
- Pathway detail with rationale, ordered intermediate outcomes, mandatory
  indicators and suggested-activity counts
- Pathway-centric configuration shared across every Outcome–Pathway link
- A configuration overview listing every unique selected pathway once,
  prioritising pathways that still need attention and showing each linked
  Final Outcome's Primary/Related relationship
- Read-only standard Intermediate Outcome chains
- Automatically included, mandatory Primary indicators
- Optional standard additional indicators and project-specific indicators
- Individually selectable standard suggested activities with project notes
- Project-specific activities
- Intermediate Outcome-level inputs using configurable categories
- A mandatory activity rule: every Intermediate Outcome needs at least one
  activity (a selected suggested activity or a project-specific activity)
  before its pathway can be marked Configured
- Inputs, Additional indicators and activity notes remain optional
- Objective Not started, In progress and Configured status
- Explicit “saved for this session” messaging for editable details
- A clear Done action returning to the configuration overview
- Review-stage progression after every pathway has been confirmed; missing
  activities block confirmation, while inputs and Additional indicators do not
- Users may return from Configure to Choose without losing configuration
  (`Add or change outcomes and pathways`)
- One optional Custom Innovation Final Outcome per project, labelled as custom
  innovation and kept only in project state
- Required organisational Impact Area alignment for custom content, using the
  existing Income, Food, Inclusion and Climate impacts
- One custom pathway with an ordered Intermediate Outcome chain, Move up /
  Move down controls, and project-specific indicators, activities and inputs
- Review Project Design: project details, de-duplicated Impact Areas, selected
  standard Final Outcomes, unique selected pathways shown once, and a separate
  CUSTOM INNOVATION section
- An objective Project design readiness checklist based on required design
  rules, not a subjective MEL quality score
- Continue to review project enabled only when standard Primary pathway and
  confirmation rules pass, and any present custom outcome is structurally
  complete
- Responsive project summary with relationship and configuration
  status
- Explicit unique-pathway and outcome-to-pathway relationship state logic
- Read-only generated Theory of Change with de-duplicated Impact, Final
  Outcome and pathway nodes; ordered Intermediate Outcome chains; distinct
  Primary/Related edges; Custom Innovation support; pan, zoom, fit-to-view,
  full-screen viewing and keyboard-accessible node detail
- Loading, error and empty states for local framework data

A project may include any number of standard Final Outcomes allowed by the
framework, plus a maximum of one optional Custom Innovation Final Outcome.
Custom content is never written into the framework reference file. It remains
project-level and must link to at least one existing organisational Impact
Area. Custom pathways require a name, description, why-this-pathway rationale,
and at least one Intermediate Outcome with a Primary indicator and at least
one activity. Additional indicators, inputs and activity notes stay optional.

Project persistence now sits behind a typed `ProjectRepository`. Local mode
uses browser `localStorage`, while SharePoint mode calls the tenant-neutral
`/api/projects` contract. Explicit Save, dirty/saving/error states, project
creation, reopening, listing and ETag conflict recovery are implemented.
Approval submission remains deliberately deferred.

The SharePoint implementation keeps queryable metadata in the
**GPF - Project Designs** list and stores each authoritative
`PersistedProjectDesignV1` payload as `ProjectDesign-<ProjectId>.json` in the
**GPF - Project Design Files** document library. Confirmed SharePoint internal
field names are centralized in `api/sharePointProjectSchema.ts`; generated
names such as `field_1` are not used elsewhere. The repository token represents
both list-item and file ETags, so this split remains invisible to React and
domain code.

The JSON file is authoritative; list columns are a searchable projection.
Two-resource updates write the file first. If only the metadata projection
fails, the UI reports that the design was saved and offers a metadata-only
retry. The reusable server storage contract also supports idempotent create,
orphan reporting/cleanup and rebuilding metadata from authoritative JSON.

The normalized reference files are:

- Historic: `src/data/framework-v1.0-normalized.json` (`PF-1.0-NORMALIZED-PR1`, schema `1.2`)
- Current proposed source: `src/data/framework-v1.1-output-phrase-reviewed-ambiguous.json` (`PF-1.1-OUTPUT-PHRASE-DRAFT`, schema `1.3`)
- Phrase review: `src/data/framework-v1.1-output-phrase-review-updated.csv`

Saved projects resolve against the exact framework version stored on the
document. The proposed dataset adds only optional `outputPhrase` metadata and
does not assign or infer output units. Existing activity text, sort order,
Intermediate Outcome relationships, pathway relationships and framework IDs
are unchanged. `scripts/import-output-phrase-framework.mjs` validates these
protected fields when importing the reviewed sources. The framework JSON
schema is `src/data/framework.schema.json`.

It remains read-only application reference data. Governance and provenance
fields in that source are intentionally not exposed in the project-design UI.
The framework JSON contains no input-category records. Application input
categories are therefore maintained separately in
`src/data/inputCategories.ts`; the MEL framework JSON is not modified.

Runtime project configuration remains typed React state. Serialization is an
explicit versioned boundary: standard selections retain Framework Indicator,
Activity, Outcome, Pathway and Intermediate Outcome IDs, while custom project
records are stored in full. UI-only state and generated Theory of Change data
are not persisted. Budget, unit cost, currency and financial calculations are
not part of input configuration.

Saved projects retain exact framework and framework-schema versions.
Historical immutable framework datasets must remain available for every
persisted version; compatibility is not relaxed to the current framework.

## Security and production boundaries

Production SharePoint access happens only through Azure Functions under
`/api/projects`. Browser code never calls SharePoint directly. Production
Vite builds select `SharePointProjectRepository` automatically; local
development keeps the browser `localStorage` repository. The Functions,
certificate authentication and Graph storage gateway are implemented in
`api/`. Remaining work is deployment and Azure Static Web Apps Entra login,
documented in `docs/sharepoint-persistence-setup.md`.

The approved app-only `Sites.Selected` design keeps native SharePoint
`Author`/`Editor` audit fields and adds explicit human audit columns. The API
must derive those values from the verified SWA/Entra principal, preserve
creator identity during updates and perform authentication and authorization
server-side.

Production authentication is designed for Azure Static Web Apps
authentication. The
development identity in `src/services/authService.ts` is returned only when
Vite's `DEV` flag is true; production deliberately has no mock fallback.
The production adapter reads the authenticated SWA `/.auth/me` principal.
Tenant registration and SWA authentication configuration have not been
performed.

Never commit credentials, certificates, secrets or sensitive environment
values. The confirmed SharePoint site URL and schema names are non-secret
configuration.

## Deliberately deferred

- Azure Static Web Apps production Entra authentication configuration
- GitHub Actions `AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_WAVE_021AD9203` and first production deploy
- Approval workflow and Power Automate
- Theory of Change PNG export (deferred until full-graph capture can include
  the project title and legend without viewport clipping)
- Excel export
- Plan-vs-Actual, SQL, Power BI, budgeting and framework administration

These concerns should be added behind the existing service, state and `/api`
boundaries rather than mixed into presentation components.
