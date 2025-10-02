import { HttpClient } from '../http-client';
import {
  GetOCRBlocksParams,
  GetOCRTextParams,
  GetOCRMetadataParams,
  GetOCRMetadataResponse,
} from '../types';

export class OCRAPI {
  constructor(private http: HttpClient) {}

  async getBlocks(params: GetOCRBlocksParams) {
    const { organizationId, documentId } = params;
    return this.http.get(`/v0/orgs/${organizationId}/ocr/download/blocks/${documentId}`);
  }

  async getText(params: GetOCRTextParams) {
    const { organizationId, documentId, pageNum } = params;
    const url = `/v0/orgs/${organizationId}/ocr/download/text/${documentId}${pageNum ? `?page_num=${pageNum}` : ''}`;
    return this.http.get(url);
  }

  async getMetadata(params: GetOCRMetadataParams): Promise<GetOCRMetadataResponse> {
    const { organizationId, documentId } = params;
    return this.http.get<GetOCRMetadataResponse>(`/v0/orgs/${organizationId}/ocr/download/metadata/${documentId}`);
  }
}
