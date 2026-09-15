import { describe, expect, it } from 'vitest'
import {
  SHAREPOINT_PROJECT_RESOURCE_SCHEMA,
  SHAREPOINT_PROJECT_SITE_URL,
  deserializeProjectDesignLibraryFields,
  deserializeProjectDesignListFields,
  readSharePointProjectServerConfig,
  serializeProjectDesignLibraryFields,
  serializeProjectDesignListFields,
  type ProjectDesignListFields,
} from '../../api/sharePointProjectSchema'

const listFields: ProjectDesignListFields = {
  Title: 'Project title',
  ProjectId: 'PROJECT_123',
  ProjectCode: 'P-123',
  Country: 'Kenya',
  ProjectStatus: 'Draft',
  FrameworkVersion: 'framework-1',
  FrameworkSchemaVersion: '1',
  ProjectSchemaVersion: 1,
  ProjectDesignFileId: 'drive-item-id',
  CreatedByName: 'Creator',
  CreatedByEmail: 'creator@example.org',
  CreatedByObjectId: 'creator-id',
  ModifiedByName: 'Editor',
  ModifiedByEmail: 'editor@example.org',
  ModifiedByObjectId: 'editor-id',
}

describe('confirmed SharePoint project schema', () => {
  it('centralizes the exact list display and internal field names', () => {
    expect(SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listDisplayName).toBe(
      'GPF - Project Designs',
    )
    expect(SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listFields).toEqual({
      Title: 'Title',
      ProjectId: 'field_1',
      ProjectCode: 'field_2',
      Country: 'field_3',
      ProjectStatus: 'field_4',
      FrameworkVersion: 'field_5',
      FrameworkSchemaVersion: 'field_6',
      ProjectSchemaVersion: 'ProjectSchemaVersion',
      ProjectDesignFileId: 'field_8',
      CreatedByName: 'field_9',
      CreatedByEmail: 'field_10',
      CreatedByObjectId: 'field_11',
      ModifiedByName: 'field_12',
      ModifiedByEmail: 'field_13',
      ModifiedByObjectId: 'field_14',
      Author: 'Author',
      Created: 'Created',
      Modified: 'Modified',
      Editor: 'Editor',
    })
  })

  it('serializes list writes using only confirmed internal names', () => {
    expect(serializeProjectDesignListFields(listFields)).toEqual({
      Title: 'Project title',
      field_1: 'PROJECT_123',
      field_2: 'P-123',
      field_3: 'Kenya',
      field_4: 'Draft',
      field_5: 'framework-1',
      field_6: '1',
      ProjectSchemaVersion: 1,
      field_8: 'drive-item-id',
      field_9: 'Creator',
      field_10: 'creator@example.org',
      field_11: 'creator-id',
      field_12: 'Editor',
      field_13: 'editor@example.org',
      field_14: 'editor-id',
    })
  })

  it('deserializes exact internal list fields into application metadata', () => {
    expect(
      deserializeProjectDesignListFields({
        Title: 'Project title',
        field_1: 'PROJECT_123',
        field_2: 'P-123',
        field_3: 'Kenya',
        field_4: 'Draft',
        field_5: 'framework-1',
        field_6: '1',
        ProjectSchemaVersion: 1,
        field_8: 'drive-item-id',
        field_9: 'Creator',
        field_10: 'creator@example.org',
        field_11: 'creator-id',
        field_12: 'Editor',
        field_13: 'editor@example.org',
        field_14: 'editor-id',
      }),
    ).toEqual(listFields)
  })

  it('uses the confirmed document-library names for reads and writes', () => {
    expect(SHAREPOINT_PROJECT_RESOURCE_SCHEMA.libraryDisplayName).toBe(
      'GPF - Project Design Files',
    )
    expect(SHAREPOINT_PROJECT_RESOURCE_SCHEMA.libraryFields).toEqual({
      ProjectId: 'ProjectId',
      FrameworkVersion: 'FrameworkVersion',
      FrameworkSchemaVersion: 'FrameworkSchemaVersion',
      ProjectSchemaVersion: 'ProjectSchemaVersion',
      Author: 'Author',
      Created: 'Created',
      Modified: 'Modified',
      Editor: 'Editor',
    })
    const fields = {
      ProjectId: 'PROJECT_123',
      FrameworkVersion: 'framework-1',
      FrameworkSchemaVersion: '1',
      ProjectSchemaVersion: 1,
    }
    expect(
      deserializeProjectDesignLibraryFields(
        serializeProjectDesignLibraryFields(fields),
      ),
    ).toEqual(fields)
  })

  it('reads IDs from server configuration without hard-coding them', () => {
    expect(
      readSharePointProjectServerConfig({
        SHAREPOINT_SITE_ID: 'site-id',
        SHAREPOINT_PROJECT_DESIGNS_LIST_ID: 'list-id',
        SHAREPOINT_PROJECT_DESIGN_FILES_LIBRARY_LIST_ID: 'library-list-id',
      }),
    ).toEqual({
      siteUrl: SHAREPOINT_PROJECT_SITE_URL,
      siteId: 'site-id',
      projectDesignsListId: 'list-id',
      projectDesignFilesLibraryListId: 'library-list-id',
    })
    expect(() => readSharePointProjectServerConfig({})).toThrow()
  })
})
