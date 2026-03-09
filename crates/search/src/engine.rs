use std::path::Path;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tantivy::collector::{Count, TopDocs};
use tantivy::query::{BooleanQuery, Occur, QueryParser, TermQuery};
use tantivy::schema::IndexRecordOption;
use tantivy::schema::Value;
use tantivy::tokenizer::{
    AsciiFoldingFilter, LowerCaser, RemoveLongFilter, SimpleTokenizer, TextAnalyzer,
};
use tantivy::{doc, Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument, Term};

use opennote_core::page::Page;

use crate::error::{SearchError, SearchResult};
use crate::extract::extract_text_from_page;
use crate::schema::SearchSchema;

const TOKENIZER_NAME: &str = "opennote";

pub struct SearchEngine {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter<TantivyDocument>>,
    schema: SearchSchema,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub text: String,
    #[serde(default)]
    pub notebook_id: Option<String>,
    #[serde(default)]
    pub section_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
}

fn default_limit() -> usize {
    20
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub total: u64,
    pub items: Vec<SearchResultItem>,
    pub query_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultItem {
    pub page_id: String,
    pub title: String,
    pub snippet: String,
    pub notebook_name: String,
    pub section_name: String,
    pub score: f32,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStatus {
    pub total_documents: u64,
    pub is_indexing: bool,
}

pub struct PageIndexData {
    pub page: Page,
    pub notebook_name: String,
    pub section_name: String,
    pub notebook_id: String,
    pub section_id: String,
}

impl SearchEngine {
    pub fn open_or_create(index_dir: &Path) -> SearchResult<Self> {
        let schema_def = SearchSchema::build();
        std::fs::create_dir_all(index_dir)?;

        let index = if index_dir.join("meta.json").exists() {
            Index::open_in_dir(index_dir)?
        } else {
            Index::create_in_dir(index_dir, schema_def.schema.clone())?
        };

        let tokenizer = TextAnalyzer::builder(SimpleTokenizer::default())
            .filter(RemoveLongFilter::limit(40))
            .filter(LowerCaser)
            .filter(AsciiFoldingFilter)
            .build();
        index.tokenizers().register(TOKENIZER_NAME, tokenizer);

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;

        let writer = index.writer(15_000_000)?;

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            schema: schema_def,
        })
    }

    pub fn index_page(&self, data: &PageIndexData) -> SearchResult<()> {
        let mut writer = self.writer.lock().map_err(|_| SearchError::LockPoisoned)?;
        let s = &self.schema;

        let page_id_str = data.page.id.to_string();
        let term = Term::from_field_text(s.page_id, &page_id_str);
        writer.delete_term(term);

        let content = extract_text_from_page(&data.page);
        let tags_str = data.page.tags.join(" ");

        writer.add_document(doc!(
            s.page_id => page_id_str,
            s.title => data.page.title.clone(),
            s.content => content,
            s.tags => tags_str,
            s.notebook_name => data.notebook_name.clone(),
            s.section_name => data.section_name.clone(),
            s.notebook_id => data.notebook_id.clone(),
            s.section_id => data.section_id.clone(),
            s.updated_at => data.page.updated_at.to_rfc3339(),
            s.created_at => data.page.created_at.to_rfc3339(),
        ))?;

        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    pub fn remove_page(&self, page_id: &str) -> SearchResult<()> {
        let mut writer = self.writer.lock().map_err(|_| SearchError::LockPoisoned)?;
        let term = Term::from_field_text(self.schema.page_id, page_id);
        writer.delete_term(term);
        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    pub fn rebuild(&self, pages: &[PageIndexData]) -> SearchResult<()> {
        let mut writer = self.writer.lock().map_err(|_| SearchError::LockPoisoned)?;
        writer.delete_all_documents()?;
        writer.commit()?;

        let s = &self.schema;
        for data in pages {
            let content = extract_text_from_page(&data.page);
            let tags_str = data.page.tags.join(" ");

            writer.add_document(doc!(
                s.page_id => data.page.id.to_string(),
                s.title => data.page.title.clone(),
                s.content => content,
                s.tags => tags_str,
                s.notebook_name => data.notebook_name.clone(),
                s.section_name => data.section_name.clone(),
                s.notebook_id => data.notebook_id.clone(),
                s.section_id => data.section_id.clone(),
                s.updated_at => data.page.updated_at.to_rfc3339(),
                s.created_at => data.page.created_at.to_rfc3339(),
            ))?;
        }

        writer.commit()?;
        self.reader.reload()?;
        Ok(())
    }

    pub fn search(&self, query: &SearchQuery) -> SearchResult<SearchResults> {
        let start = std::time::Instant::now();
        let searcher = self.reader.searcher();
        let s = &self.schema;

        let mut parser = QueryParser::for_index(&self.index, vec![s.title, s.content, s.tags]);
        parser.set_field_boost(s.title, 2.0);
        parser.set_field_boost(s.tags, 1.5);

        let mut must_clauses: Vec<Box<dyn tantivy::query::Query>> = Vec::new();

        if !query.text.trim().is_empty() {
            let (text_query, _errors) = parser.parse_query_lenient(&query.text);
            must_clauses.push(text_query);
        }

        if let Some(ref nb_id) = query.notebook_id {
            let nb_term = Term::from_field_text(s.notebook_id, nb_id);
            let nb_query = TermQuery::new(nb_term, IndexRecordOption::Basic);
            must_clauses.push(Box::new(nb_query));
        }

        if let Some(ref sec_id) = query.section_id {
            let sec_term = Term::from_field_text(s.section_id, sec_id);
            let sec_query = TermQuery::new(sec_term, IndexRecordOption::Basic);
            must_clauses.push(Box::new(sec_query));
        }

        if !query.tags.is_empty() {
            let tag_parser = QueryParser::for_index(&self.index, vec![s.tags]);
            for tag in &query.tags {
                let (tag_query, _) = tag_parser.parse_query_lenient(tag);
                must_clauses.push(tag_query);
            }
        }

        let final_query: Box<dyn tantivy::query::Query> = if must_clauses.is_empty() {
            Box::new(tantivy::query::AllQuery)
        } else if must_clauses.len() == 1 {
            must_clauses.pop().unwrap()
        } else {
            let boolean_clauses = must_clauses.into_iter().map(|q| (Occur::Must, q)).collect();
            Box::new(BooleanQuery::new(boolean_clauses))
        };

        let (total_count, top_docs) = searcher.search(
            &*final_query,
            &(
                Count,
                TopDocs::with_limit(query.limit).and_offset(query.offset),
            ),
        )?;

        let mut items = Vec::with_capacity(top_docs.len());
        for (score, doc_address) in &top_docs {
            let doc = searcher.doc::<tantivy::TantivyDocument>(*doc_address)?;

            let page_id = get_text_field(&doc, s.page_id);
            let title = get_text_field(&doc, s.title);
            let content = get_text_field(&doc, s.content);
            let notebook_name = get_text_field(&doc, s.notebook_name);
            let section_name = get_text_field(&doc, s.section_name);
            let updated_at = get_text_field(&doc, s.updated_at);

            let snippet = generate_snippet(&content, &query.text, 120);

            items.push(SearchResultItem {
                page_id,
                title,
                snippet,
                notebook_name,
                section_name,
                score: *score,
                updated_at,
            });
        }

        let elapsed = start.elapsed().as_millis() as u64;

        Ok(SearchResults {
            total: total_count as u64,
            items,
            query_time_ms: elapsed,
        })
    }

    pub fn quick_open(
        &self,
        query_text: &str,
        limit: usize,
    ) -> SearchResult<Vec<SearchResultItem>> {
        let searcher = self.reader.searcher();
        let s = &self.schema;

        let mut parser = QueryParser::for_index(&self.index, vec![s.title, s.content, s.tags]);
        parser.set_field_boost(s.title, 2.0); // Boost title relevance above content.
        parser.set_field_boost(s.tags, 1.5); // Tags are a strong relevance signal.

        let query = if query_text.trim().is_empty() {
            Box::new(tantivy::query::AllQuery) as Box<dyn tantivy::query::Query>
        } else {
            let terms: Vec<String> = query_text
                .split_whitespace()
                .map(|t| format!("{}*", t.to_lowercase()))
                .collect();
            let fuzzy_query = terms.join(" ");
            parser
                .parse_query(&fuzzy_query)
                .unwrap_or_else(|_| Box::new(tantivy::query::AllQuery))
        };

        let top_docs = searcher.search(&*query, &TopDocs::with_limit(limit))?;

        let mut items = Vec::with_capacity(top_docs.len());
        for (score, doc_address) in &top_docs {
            let doc = searcher.doc::<tantivy::TantivyDocument>(*doc_address)?;

            items.push(SearchResultItem {
                page_id: get_text_field(&doc, s.page_id),
                title: get_text_field(&doc, s.title),
                snippet: String::new(),
                notebook_name: get_text_field(&doc, s.notebook_name),
                section_name: get_text_field(&doc, s.section_name),
                score: *score,
                updated_at: get_text_field(&doc, s.updated_at),
            });
        }

        Ok(items)
    }

    pub fn get_status(&self) -> SearchResult<IndexStatus> {
        let searcher = self.reader.searcher();
        let total = searcher.num_docs();
        Ok(IndexStatus {
            total_documents: total,
            is_indexing: false,
        })
    }
}

impl Drop for SearchEngine {
    fn drop(&mut self) {
        if let Ok(mut writer) = self.writer.lock() {
            let _ = writer.commit();
        }
    }
}

fn get_text_field(doc: &tantivy::TantivyDocument, field: tantivy::schema::Field) -> String {
    doc.get_first(field)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn generate_snippet(content: &str, query: &str, max_len: usize) -> String {
    let query_lower = query.to_lowercase();
    let content_lower = content.to_lowercase();

    let terms: Vec<&str> = query_lower.split_whitespace().collect();
    if terms.is_empty() {
        return content.chars().take(max_len).collect();
    }

    let first_term = terms[0];
    if let Some(pos) = content_lower.find(first_term) {
        let start = pos.saturating_sub(40);
        let chars: Vec<char> = content.chars().collect();
        let end = (start + max_len).min(chars.len());
        let snippet: String = chars[start..end].iter().collect();

        let prefix = if start > 0 { "..." } else { "" };
        let suffix = if end < chars.len() { "..." } else { "" };
        format!("{prefix}{snippet}{suffix}")
    } else {
        content.chars().take(max_len).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snippet_generation_with_match() {
        let content = "This is a document about clean architecture and how it works in practice.";
        let snippet = generate_snippet(content, "clean", 50);
        assert!(snippet.contains("clean"));
    }

    #[test]
    fn snippet_generation_no_match() {
        let content = "Hello world this is a test document";
        let snippet = generate_snippet(content, "xyz", 20);
        assert_eq!(snippet, "Hello world this is ");
    }

    #[test]
    fn snippet_with_empty_query() {
        let content = "Some content here";
        let snippet = generate_snippet(content, "", 10);
        assert_eq!(snippet, "Some conte");
    }

    #[test]
    fn test_content_search_query() {
        let temp_dir = tempfile::tempdir().unwrap();
        let engine = SearchEngine::open_or_create(temp_dir.path()).unwrap();

        let mut page = Page::new(opennote_core::id::SectionId::new(), "My title").unwrap();

        // Add a block
        let json = serde_json::json!({
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        { "type": "text", "text": "This is a special content word called abracadabra." }
                    ]
                }
            ]
        });
        page.add_block(opennote_core::block::Block::new_text(0, json))
            .unwrap();

        let data = PageIndexData {
            page: page.clone(),
            notebook_name: "NB".to_string(),
            section_name: "SEC".to_string(),
            notebook_id: "nb1".to_string(),
            section_id: "sec1".to_string(),
        };

        engine.index_page(&data).unwrap();

        // Let's search using the regular search function
        let sq = SearchQuery {
            text: "abracadabra".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        };

        let result = engine.search(&sq).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].title, "My title");
    }
}
