export interface DocumentWithContent {
  name: string;
  content: string;
  tag_ids?: string[];  // Optional list of tag IDs
}

export interface UploadDocumentsParams {
  organizationId: string;
  documents: DocumentWithContent[];
}

export interface UploadDocumentsResponse {
  uploaded_documents: Array<{
    document_name: string;
    document_id: string;
  }>;
}

export interface UploadedDocument {
    document_name: string;
    document_id: string;
}

export interface DocumentMetadata {
    id: string;
    document_name: string;
    upload_date: string;
    uploaded_by: string;
    state: string;
    tag_ids: string[];  // List of tag IDs
}

export interface ListDocumentsResponse {
    documents: DocumentMetadata[];
    total_count: number;
    skip: number;
}

export interface ListDocumentsParams {
  organization_id: string;
  skip?: number;
  limit?: number;
  tag_ids?: string;  // Added tag_ids parameter for filtering
}

export interface GetDocumentResponse {
  metadata: DocumentMetadata;
  content: ArrayBuffer;
}

export interface DocumentUpdate {
  tag_ids: string[];
}
