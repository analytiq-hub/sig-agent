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

export interface ListTagsResponse {
    tags: Tag[];
}
