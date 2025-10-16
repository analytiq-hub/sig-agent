export interface GetOCRBlocksParams {
    organizationId: string;
    documentId: string;
}

export interface GetOCRTextParams {
    organizationId: string;
    documentId: string;
    pageNum?: number;
}

export interface GetOCRMetadataParams {
    organizationId: string;
    documentId: string;
}

export interface GetOCRMetadataResponse {
    n_pages: number;
    ocr_date: string;
}