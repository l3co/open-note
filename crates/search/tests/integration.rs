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
