export interface TagConfig {
    name: string;
    color?: string;
    description?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}


export interface CreateTagParams {
  organizationId: string;
  tag: TagConfig;
}

export interface ListTagsParams {
  organizationId: string;
}

export interface ListTagsResponse {
    tags: Tag[];
}

export interface UpdateTagParams {
  organizationId: string;
  tagId: string;
  tag: TagConfig;
}

export interface DeleteTagParams {
  organizationId: string;
  tagId: string;
}
