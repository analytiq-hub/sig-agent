import { DocRouterOrg } from '../../src';
import { getTestDatabase, getBaseUrl, createTestFixtures } from '../setup/jest-setup';

describe('Documents Integration Tests', () => {
  let tokens: any;
  let client: DocRouterOrg;

  beforeEach(async () => {
    const testDb = getTestDatabase();
    const baseUrl = getBaseUrl();
    tokens = await createTestFixtures(testDb, baseUrl);

    client = new DocRouterOrg({
      baseURL: baseUrl,
      orgToken: tokens.admin.token,
      organizationId: tokens.org_id
    });
  });

  // Helper to create a minimal PDF
  function createMinimalPdf(): ArrayBuffer {
    const pdfContent = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n";
    const encoder = new TextEncoder();
    return encoder.encode(pdfContent).buffer;
  }

  describe('upload', () => {
    test('should upload a document', async () => {
      const response = await client.documents.upload({
        documents: [{
          name: 'test.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });

      expect(response.documents).toBeDefined();
      expect(response.documents.length).toBe(1);
      expect(response.documents[0].document_name).toBe('test.pdf');
    });

    test('should upload document with metadata', async () => {
      const metadata = { author: 'Test User', department: 'Testing' };

      const response = await client.documents.upload({
        documents: [{
          name: 'test-metadata.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf',
          metadata
        }]
      });

      expect(response.documents[0].metadata).toEqual(metadata);
    });

    test('should upload multiple documents', async () => {
      const response = await client.documents.upload({
        documents: [
          { name: 'test1.pdf', content: createMinimalPdf(), type: 'application/pdf' },
          { name: 'test2.pdf', content: createMinimalPdf(), type: 'application/pdf' }
        ]
      });

      expect(response.documents.length).toBe(2);
    });
  });

  describe('list', () => {
    test('should list documents', async () => {
      const response = await client.documents.list();

      expect(response.documents).toBeDefined();
      expect(Array.isArray(response.documents)).toBe(true);
    });

    test('should list documents with skip parameter', async () => {
      const response = await client.documents.list({
        skip: 0
      });

      expect(response.skip).toBe(0);
    });

    test('should list documents with limit parameter', async () => {
      const response = await client.documents.list({
        limit: 5
      });

      expect(response.documents.length).toBeLessThanOrEqual(5);
    });

    test('should list documents with nameSearch parameter', async () => {
      // Upload a document first
      await client.documents.upload({
        documents: [{
          name: 'searchable-document.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });

      const response = await client.documents.list({
        nameSearch: 'searchable'
      });

      expect(response.documents.length).toBeGreaterThan(0);
      expect(response.documents[0].document_name).toContain('searchable');
    });

    test('should list documents with metadataSearch parameter', async () => {
      // Upload a document with metadata
      await client.documents.upload({
        documents: [{
          name: 'metadata-doc.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf',
          metadata: { type: 'invoice' }
        }]
      });

      const response = await client.documents.list({
        metadataSearch: 'type=invoice'
      });

      expect(response.documents.length).toBeGreaterThan(0);
    });

    test('should list documents with tagIds parameter', async () => {
      // Create a tag first
      const tagResponse = await client.tags.create({
        tag: {
          name: 'Test Tag',
          color: '#FF0000'
        }
      });
      const tagId = tagResponse.id;

      // Upload a document with the tag
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'tagged-doc.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      // Update document with tag
      await client.documents.update({
        documentId: docId,
        tagIds: [tagId]
      });

      // List with tag filter
      const response = await client.documents.list({
        tagIds: tagId
      });

      expect(response.documents.length).toBeGreaterThan(0);
      const taggedDoc = response.documents.find(d => d.id === docId);
      expect(taggedDoc?.tag_ids).toContain(tagId);
    });
  });

  describe('get', () => {
    test('should get document by id', async () => {
      // Upload a document first
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'get-test.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      const response = await client.documents.get({
        documentId: docId,
        fileType: 'original'
      });

      expect(response.id).toBe(docId);
      expect(response.document_name).toBe('get-test.pdf');
      expect(response.content).toBeDefined();
    });

    test('should get document with fileType=pdf parameter', async () => {
      // Upload a document first
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'pdf-type-test.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      const response = await client.documents.get({
        documentId: docId,
        fileType: 'pdf'
      });

      expect(response.id).toBe(docId);
      expect(response.content).toBeDefined();
    });
  });

  describe('update', () => {
    test('should update document name', async () => {
      // Upload a document first
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'original-name.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      await client.documents.update({
        documentId: docId,
        documentName: 'updated-name.pdf'
      });

      const response = await client.documents.get({
        documentId: docId,
        fileType: 'original'
      });

      expect(response.document_name).toBe('updated-name.pdf');
    });

    test('should update document tagIds', async () => {
      // Create a tag
      const tagResponse = await client.tags.create({
        tag: {
          name: 'Update Tag',
          color: '#00FF00'
        }
      });
      const tagId = tagResponse.id;

      // Upload a document
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'tag-update-test.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      // Update with tag
      await client.documents.update({
        documentId: docId,
        tagIds: [tagId]
      });

      const response = await client.documents.get({
        documentId: docId,
        fileType: 'original'
      });

      expect(response.tag_ids).toContain(tagId);
    });

    test('should update document metadata', async () => {
      // Upload a document
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'metadata-update-test.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      const newMetadata = { status: 'reviewed', reviewer: 'Admin' };

      // Update metadata
      await client.documents.update({
        documentId: docId,
        metadata: newMetadata
      });

      const response = await client.documents.get({
        documentId: docId,
        fileType: 'original'
      });

      expect(response.metadata).toEqual(newMetadata);
    });
  });

  describe('delete', () => {
    test('should delete document', async () => {
      // Upload a document first
      const uploadResponse = await client.documents.upload({
        documents: [{
          name: 'delete-test.pdf',
          content: createMinimalPdf(),
          type: 'application/pdf'
        }]
      });
      const docId = uploadResponse.documents[0].document_id;

      // Delete the document
      await client.documents.delete({
        documentId: docId
      });

      // Verify it's deleted
      await expect(client.documents.get({
        documentId: docId,
        fileType: 'original'
      })).rejects.toThrow();
    });
  });
});
