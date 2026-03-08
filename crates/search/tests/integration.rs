use std::sync::Arc;

use opennote_core::block::Block;
use opennote_core::id::SectionId;
use opennote_core::page::Page;
use opennote_search::engine::{PageIndexData, SearchEngine, SearchQuery};

fn make_page(title: &str, text_content: &str, tags: Vec<&str>) -> Page {
    let mut page = Page::new(SectionId::new(), title).unwrap();
    if !text_content.is_empty() {
        let json = serde_json::json!({
            "type": "doc",
            "content": [{
                "type": "paragraph",
                "content": [{ "type": "text", "text": text_content }]
            }]
        });
        page.add_block(Block::new_text(0, json)).unwrap();
    }
    for tag in tags {
        page.add_tag(tag);
    }
    page
}

fn make_index_data(page: Page) -> PageIndexData {
    PageIndexData {
        page,
        notebook_name: "Test Notebook".to_string(),
        section_name: "Test Section".to_string(),
        notebook_id: "nb-1".to_string(),
        section_id: "sec-1".to_string(),
    }
}

fn make_index_data_with_context(
    page: Page,
    nb_name: &str,
    sec_name: &str,
    nb_id: &str,
    sec_id: &str,
) -> PageIndexData {
    PageIndexData {
        page,
        notebook_name: nb_name.to_string(),
        section_name: sec_name.to_string(),
        notebook_id: nb_id.to_string(),
        section_id: sec_id.to_string(),
    }
}

fn temp_engine() -> (SearchEngine, tempfile::TempDir) {
    let dir = tempfile::tempdir().unwrap();
    let engine = SearchEngine::open_or_create(dir.path()).unwrap();
    (engine, dir)
}

#[test]
fn index_and_search_single_page() {
    let (engine, _dir) = temp_engine();
    let page = make_page(
        "Aula de Rust",
        "Aprendendo ownership e borrowing",
        vec!["estudo"],
    );
    let data = make_index_data(page);

    engine.index_page(&data).unwrap();

    let results = engine
        .search(&SearchQuery {
            text: "ownership".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();

    assert_eq!(results.items.len(), 1);
    assert_eq!(results.items[0].title, "Aula de Rust");
    assert!(results.items[0].snippet.contains("ownership"));
}

#[test]
fn search_by_title() {
    let (engine, _dir) = temp_engine();

    let p1 = make_page("Clean Architecture", "Camadas e dependências", vec![]);
    let p2 = make_page("Design Patterns", "Factory, Strategy, Observer", vec![]);
    engine.index_page(&make_index_data(p1)).unwrap();
    engine.index_page(&make_index_data(p2)).unwrap();

    let results = engine
        .search(&SearchQuery {
            text: "Clean".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();

    assert_eq!(results.items.len(), 1);
    assert_eq!(results.items[0].title, "Clean Architecture");
}

#[test]
fn search_returns_empty_for_no_match() {
    let (engine, _dir) = temp_engine();
    let page = make_page("Notas do dia", "Reunião de planejamento", vec![]);
    engine.index_page(&make_index_data(page)).unwrap();

    let results = engine
        .search(&SearchQuery {
            text: "kubernetes".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();

    assert_eq!(results.items.len(), 0);
}

#[test]
fn remove_page_from_index() {
    let (engine, _dir) = temp_engine();
    let page = make_page("Temporário", "Conteúdo efêmero", vec![]);
    let page_id = page.id.to_string();
    engine.index_page(&make_index_data(page)).unwrap();

    engine.remove_page(&page_id).unwrap();

    let results = engine
        .search(&SearchQuery {
            text: "efêmero".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();

    assert_eq!(results.items.len(), 0);
}

#[test]
fn rebuild_replaces_all_documents() {
    let (engine, _dir) = temp_engine();

    let p1 = make_page("Velha", "Conteúdo antigo", vec![]);
    engine.index_page(&make_index_data(p1)).unwrap();

    let p2 = make_page("Nova", "Conteúdo novo", vec![]);
    engine.rebuild(&[make_index_data(p2)]).unwrap();

    let status = engine.get_status().unwrap();
    assert_eq!(status.total_documents, 1);

    let results = engine
        .search(&SearchQuery {
            text: "antigo".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(results.items.len(), 0);

    let results = engine
        .search(&SearchQuery {
            text: "novo".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(results.items.len(), 1);
}

#[test]
fn quick_open_by_title() {
    let (engine, _dir) = temp_engine();

    let p1 = make_page("Reunião Segunda", "Pauta da reunião", vec![]);
    let p2 = make_page("Projeto Final", "Entrega do projeto", vec![]);
    let p3 = make_page("Reunião Terça", "Follow-up", vec![]);
    engine.index_page(&make_index_data(p1)).unwrap();
    engine.index_page(&make_index_data(p2)).unwrap();
    engine.index_page(&make_index_data(p3)).unwrap();

    let results = engine.quick_open("Reunião", 10).unwrap();
    assert!(results.len() >= 2);
    for r in &results {
        assert!(r.title.contains("Reunião"));
    }
}

#[test]
fn get_status_returns_document_count() {
    let (engine, _dir) = temp_engine();

    let status = engine.get_status().unwrap();
    assert_eq!(status.total_documents, 0);
    assert!(!status.is_indexing);

    let page = make_page("Status Test", "Some content", vec![]);
    engine.index_page(&make_index_data(page)).unwrap();

    let status = engine.get_status().unwrap();
    assert_eq!(status.total_documents, 1);
}

#[test]
fn reindex_page_updates_content() {
    let (engine, _dir) = temp_engine();

    let mut page = make_page("Evolução", "conteúdo original antigo", vec![]);
    let page_id = page.id;
    engine.index_page(&make_index_data(page.clone())).unwrap();

    page.blocks.clear();
    let json = serde_json::json!({
        "type": "doc",
        "content": [{
            "type": "paragraph",
            "content": [{ "type": "text", "text": "texto renovado completamente diferente" }]
        }]
    });
    page.add_block(Block::new_text(0, json)).unwrap();
    engine.index_page(&make_index_data(page)).unwrap();

    let old = engine
        .search(&SearchQuery {
            text: "antigo".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(old.items.len(), 0);

    let new = engine
        .search(&SearchQuery {
            text: "completamente".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(new.items.len(), 1);
    assert_eq!(new.items[0].page_id, page_id.to_string());
}

// ─── Phase 3 Retrofit: ASCII Folding (PT-BR) ───

#[test]
fn test_search_case_and_diacritic_insensitivity() {
    let (engine, _dir) = temp_engine();
    let page = make_page(
        "Educação",
        "Análise de currículo profissional",
        vec!["formação"],
    );
    engine.index_page(&make_index_data(page)).unwrap();

    // Folding: ç→c, ã→a
    let r1 = engine
        .search(&SearchQuery {
            text: "educacao".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(
        r1.items.len(),
        1,
        "Should find 'Educação' when searching 'educacao'"
    );

    // Folding: í→i
    let r2 = engine
        .search(&SearchQuery {
            text: "curriculo".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(
        r2.items.len(),
        1,
        "Should find 'currículo' when searching 'curriculo'"
    );

    // Case insensitive with accents
    let r3 = engine
        .search(&SearchQuery {
            text: "EDUCAÇÃO".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(
        r3.items.len(),
        1,
        "Should find case-insensitive with accents"
    );
}

// ─── Phase 3 Retrofit: Special Characters Handling ───

#[test]
fn test_search_special_characters_handling() {
    let (engine, _dir) = temp_engine();
    let page = make_page("Código Rust", "fn main() { println!(\"hello\"); }", vec![]);
    engine.index_page(&make_index_data(page)).unwrap();

    // Parentheses
    let r1 = engine.search(&SearchQuery {
        text: "fn main()".to_string(),
        notebook_id: None,
        section_id: None,
        tags: vec![],
        limit: 10,
        offset: 0,
    });
    assert!(r1.is_ok(), "Parentheses should not cause panic");

    // Exclamation marks
    let r2 = engine.search(&SearchQuery {
        text: "!!Atenção!!".to_string(),
        notebook_id: None,
        section_id: None,
        tags: vec![],
        limit: 10,
        offset: 0,
    });
    assert!(r2.is_ok(), "Exclamation marks should not cause panic");

    // At sign
    let r3 = engine.search(&SearchQuery {
        text: "user@email.com".to_string(),
        notebook_id: None,
        section_id: None,
        tags: vec![],
        limit: 10,
        offset: 0,
    });
    assert!(r3.is_ok(), "At sign should not cause panic");

    // Empty boolean operators
    let r4 = engine.search(&SearchQuery {
        text: "()".to_string(),
        notebook_id: None,
        section_id: None,
        tags: vec![],
        limit: 10,
        offset: 0,
    });
    assert!(r4.is_ok(), "Empty parens should not cause panic");
}

// ─── Phase 3 Retrofit: Notebook & Section Filters ───

#[test]
fn test_search_with_notebook_filter() {
    let (engine, _dir) = temp_engine();

    let p1 = make_page("Rust Basics", "ownership and borrowing", vec![]);
    let p2 = make_page("Rust Advanced", "lifetimes and traits", vec![]);
    let p3 = make_page("Python Basics", "variables and functions", vec![]);

    engine
        .index_page(&make_index_data_with_context(
            p1, "NB Rust", "Sec1", "nb-1", "sec-1",
        ))
        .unwrap();
    engine
        .index_page(&make_index_data_with_context(
            p2, "NB Rust", "Sec2", "nb-1", "sec-2",
        ))
        .unwrap();
    engine
        .index_page(&make_index_data_with_context(
            p3,
            "NB Python",
            "Sec1",
            "nb-2",
            "sec-3",
        ))
        .unwrap();

    let results = engine
        .search(&SearchQuery {
            text: "Basics".to_string(),
            notebook_id: Some("nb-1".to_string()),
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();

    assert_eq!(results.items.len(), 1);
    assert_eq!(results.items[0].title, "Rust Basics");
}

#[test]
fn test_search_with_section_filter() {
    let (engine, _dir) = temp_engine();

    let p1 = make_page("Aula 1", "introdução ao tema", vec![]);
    let p2 = make_page("Aula 2", "aprofundamento do tema", vec![]);

    engine
        .index_page(&make_index_data_with_context(
            p1, "NB", "Sec A", "nb-1", "sec-a",
        ))
        .unwrap();
    engine
        .index_page(&make_index_data_with_context(
            p2, "NB", "Sec B", "nb-1", "sec-b",
        ))
        .unwrap();

    let results = engine
        .search(&SearchQuery {
            text: "tema".to_string(),
            notebook_id: None,
            section_id: Some("sec-a".to_string()),
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();

    assert_eq!(results.items.len(), 1);
    assert_eq!(results.items[0].title, "Aula 1");
}

// ─── Phase 3 Retrofit: Pagination ───

#[test]
fn test_search_pagination_boundaries() {
    let (engine, _dir) = temp_engine();

    for i in 0..15 {
        let page = make_page(
            &format!("Rust Page {i}"),
            "Content about Rust programming",
            vec![],
        );
        engine.index_page(&make_index_data(page)).unwrap();
    }

    // First page: 10 results
    let r1 = engine
        .search(&SearchQuery {
            text: "Rust".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 0,
        })
        .unwrap();
    assert_eq!(r1.items.len(), 10);

    // Second page: remaining 5
    let r2 = engine
        .search(&SearchQuery {
            text: "Rust".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 10,
        })
        .unwrap();
    assert_eq!(r2.items.len(), 5);

    // Beyond total: empty
    let r3 = engine
        .search(&SearchQuery {
            text: "Rust".to_string(),
            notebook_id: None,
            section_id: None,
            tags: vec![],
            limit: 10,
            offset: 50,
        })
        .unwrap();
    assert_eq!(r3.items.len(), 0);
}

// ─── Phase 3 Retrofit: Concurrent Read+Index ───

#[test]
fn test_concurrent_read_and_index_operations() {
    let dir = tempfile::tempdir().unwrap();
    let engine = Arc::new(SearchEngine::open_or_create(dir.path()).unwrap());

    // Seed with initial data
    let seed = make_page("Initial", "seed content for searching", vec![]);
    engine.index_page(&make_index_data(seed)).unwrap();

    let engine_writer = Arc::clone(&engine);
    let engine_reader = Arc::clone(&engine);

    let writer_handle = std::thread::spawn(move || {
        for i in 0..10 {
            let page = make_page(
                &format!("Concurrent Page {i}"),
                "concurrent indexing content",
                vec![],
            );
            engine_writer.index_page(&make_index_data(page)).unwrap();
        }
    });

    let reader_handle = std::thread::spawn(move || {
        let mut success_count = 0;
        for _ in 0..20 {
            let result = engine_reader.search(&SearchQuery {
                text: "content".to_string(),
                notebook_id: None,
                section_id: None,
                tags: vec![],
                limit: 100,
                offset: 0,
            });
            if result.is_ok() {
                success_count += 1;
            }
        }
        success_count
    });

    writer_handle.join().unwrap();
    let successes = reader_handle.join().unwrap();
    assert_eq!(successes, 20, "All reads should succeed without deadlock");
}

// ─── Phase 3 Retrofit: Recovery & Idempotency ───

#[test]
fn test_engine_recovery_from_corrupt_index() {
    let dir = tempfile::tempdir().unwrap();

    // Create engine, index a page, then drop
    {
        let engine = SearchEngine::open_or_create(dir.path()).unwrap();
        let page = make_page("Before Corruption", "some content", vec![]);
        engine.index_page(&make_index_data(page)).unwrap();
        let status = engine.get_status().unwrap();
        assert_eq!(status.total_documents, 1);
    }

    // Corrupt the index by deleting meta.json
    let meta = dir.path().join("meta.json");
    if meta.exists() {
        std::fs::remove_file(&meta).unwrap();
    }

    // Re-open should recreate the index from scratch
    let engine = SearchEngine::open_or_create(dir.path()).unwrap();
    let status = engine.get_status().unwrap();
    assert_eq!(status.total_documents, 0, "Recreated index should be empty");
}

#[test]
fn test_rebuild_is_idempotent() {
    let (engine, _dir) = temp_engine();

    let p1 = make_page("Page A", "content alpha", vec!["tag1"]);
    let p2 = make_page("Page B", "content beta", vec!["tag2"]);
    let pages = vec![make_index_data(p1), make_index_data(p2)];

    engine.rebuild(&pages).unwrap();
    let s1 = engine.get_status().unwrap();
    assert_eq!(s1.total_documents, 2);

    engine.rebuild(&pages).unwrap();
    let s2 = engine.get_status().unwrap();
    assert_eq!(
        s2.total_documents, 2,
        "Rebuild should not duplicate documents"
    );
}
