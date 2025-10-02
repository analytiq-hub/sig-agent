import { HttpClient } from '../http-client';
import {
  Tag,
  CreateTagParams,
  ListTagsParams,
  ListTagsResponse,
  UpdateTagParams,
  DeleteTagParams,
} from '../types';

export class TagsAPI {
  constructor(private http: HttpClient) {}

  async create(params: CreateTagParams): Promise<Tag> {
    const { organizationId, tag } = params;
    return this.http.post<Tag>(`/v0/orgs/${organizationId}/tags`, tag);
  }

  async get({
    organizationId,
    tagId,
  }: {
    organizationId: string;
    tagId: string;
  }): Promise<Tag> {
    return this.http.get<Tag>(`/v0/orgs/${organizationId}/tags/${tagId}`);
  }

  async list(params: ListTagsParams): Promise<ListTagsResponse> {
    const { organizationId, skip, limit, nameSearch } = params;
    return this.http.get<ListTagsResponse>(`/v0/orgs/${organizationId}/tags`, {
      params: {
        skip: skip || 0,
        limit: limit || 10,
        name_search: nameSearch
      }
    });
  }

  async update(params: UpdateTagParams): Promise<Tag> {
    const { organizationId, tagId, tag } = params;
    return this.http.put<Tag>(`/v0/orgs/${organizationId}/tags/${tagId}`, tag);
  }

  async delete(params: DeleteTagParams): Promise<void> {
    const { organizationId, tagId } = params;
    await this.http.delete(`/v0/orgs/${organizationId}/tags/${tagId}`);
  }
}
