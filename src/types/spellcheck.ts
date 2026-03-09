export interface SpellCheckRequest {
  text: string;
  language: string;
}

export interface SpellCheckMatch {
  message: string;
  offset: number;
  length: number;
  replacements: string[];
  rule_id: string;
  rule_description: string;
  category: string;
}

export interface SpellCheckResponse {
  matches: SpellCheckMatch[];
  language: string;
}
