import { HttpClient } from '../http-client';
import {
  UploadDocumentsParams,
  UploadDocumentsResponse,
  GetDocumentParams,
  GetDocumentResponse,
  UpdateDocumentParams,
  DeleteDocumentParams,
  ListDocumentsParams,
  ListDocumentsResponse,
} from '../types';

export class DocumentsAPI {
  constructor(private http: HttpClient) {}

  async upload(params: UploadDocumentsParams): Promise<UploadDocumentsResponse> {
    const { organizationId, documents } = params;

    // Convert documents to JSON format with base64-encoded content
    const documentsPayload = documents.map(doc => {
      // Convert content to base64
      let base64Content: string;
      if (doc.content instanceof ArrayBuffer) {
        const buffer = Buffer.from(doc.content);
        base64Content = buffer.toString('base64');
      } else if (doc.content instanceof Buffer) {
        base64Content = doc.content.toString('base64');
      } else if (doc.content instanceof Uint8Array) {
        const buffer = Buffer.from(doc.content);
        base64Content = buffer.toString('base64');
      } else {
        const buffer = Buffer.from(doc.content);
        base64Content = buffer.toString('base64');
      }

      const payload: any = {
        name: doc.name,
        content: base64Content
      };

      if (doc.metadata) {
        payload.metadata = doc.metadata;
      }

      return payload;
    });

    return this.http.post<UploadDocumentsResponse>(
      `/v0/orgs/${organizationId}/documents`,
      { documents: documentsPayload }
    );
  }

  async list(params?: ListDocumentsParams): Promise<ListDocumentsResponse> {
    const queryParams: Record<string, string | number | undefined> = {
      skip: params?.skip || 0,
      limit: params?.limit || 10,
    };

    if (params?.tagIds) {
      queryParams.tag_ids = params.tagIds;
    }

    if (params?.nameSearch) {
      queryParams.name_search = params.nameSearch;
    }

    if (params?.metadataSearch) {
      queryParams.metadata_search = params.metadataSearch;
    }

    return this.http.get<ListDocumentsResponse>(`/v0/orgs/${params?.organizationId}/documents`, {
      params: queryParams
    });
  }

  async get(params: GetDocumentParams): Promise<GetDocumentResponse> {
    const { organizationId, documentId, fileType } = params;
    const response = await this.http.get<{
      id: string;
      pdf_id: string;
      document_name: string;
      upload_date: string;
      uploaded_by: string;
      state: string;
      tag_ids: string[];
      type: string;
      metadata: Record<string, string>;
      content: string; // base64 encoded
    }>(`/v0/orgs/${organizationId}/documents/${documentId}?file_type=${fileType}`);
    
    // Convert base64 content back to ArrayBuffer
    const binaryContent = atob(response.content);
    const len = binaryContent.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryContent.charCodeAt(i);
    }

    return {
      id: response.id,
      pdf_id: response.pdf_id,
      document_name: response.document_name,
      upload_date: response.upload_date,
      uploaded_by: response.uploaded_by,
      state: response.state,
      tag_ids: response.tag_ids,
      type: response.type,
      metadata: response.metadata,
      content: bytes.buffer
    };
  }

  async update(params: UpdateDocumentParams) {
    const { organizationId, documentId, documentName, tagIds, metadata } = params;
    const updateData: { tag_ids?: string[]; document_name?: string; metadata?: Record<string, string> } = {};
    
    if (documentName !== undefined) {
      updateData.document_name = documentName;
    }

    if (tagIds !== undefined) {
      updateData.tag_ids = tagIds;
    }

    if (metadata !== undefined) {
      updateData.metadata = metadata;
    }
    
    return this.http.put(`/v0/orgs/${organizationId}/documents/${documentId}`, updateData);
  }

  async delete(params: DeleteDocumentParams) {
    const { organizationId, documentId } = params;
    return this.http.delete(`/v0/orgs/${organizationId}/documents/${documentId}`);
  }
}
