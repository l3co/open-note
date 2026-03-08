export interface SearchQuery {
  text: string;
  notebook_id?: string;
  section_id?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResultItem {
  page_id: string;
  title: string;
  snippet: string;
  notebook_name: string;
  section_name: string;
  score: number;
  updated_at: string;
}

export interface SearchResults {
  total: number;
  items: SearchResultItem[];
  query_time_ms: number;
}

export interface IndexStatus {
  total_documents: number;
  is_indexing: boolean;
}
