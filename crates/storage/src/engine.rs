use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use opennote_core::id::{NotebookId, PageId, SectionId};
use opennote_core::notebook::Notebook;
use opennote_core::page::{Page, PageSummary};
use opennote_core::section::Section;
use opennote_core::settings::AppState;
use opennote_core::trash::{TrashItem, TrashItemType, TrashManifest};
use opennote_core::workspace::Workspace;

use crate::atomic::{atomic_write_json, read_json};
use crate::error::{StorageError, StorageResult};
use crate::lock;
use crate::migrations::migrate_app_state_if_needed;
use crate::slug::unique_slug;

const WORKSPACE_FILE: &str = "workspace.json";
const NOTEBOOK_FILE: &str = "notebook.json";
const SECTION_FILE: &str = "section.json";
const TRASH_DIR: &str = ".trash";
const TRASH_MANIFEST_FILE: &str = "trash_manifest.json";
const ASSETS_DIR: &str = "assets";
const PAGE_EXTENSION: &str = "opn.json";
const APP_STATE_DIR: &str = ".opennote";
const APP_STATE_FILE: &str = "app_state.json";

pub struct FsStorageEngine;

impl FsStorageEngine {
    // ─── App State ───

    pub fn app_state_path() -> StorageResult<PathBuf> {
        let home = dirs_home().ok_or_else(|| StorageError::Io {
            source: std::io::Error::new(std::io::ErrorKind::NotFound, "Home directory not found"),
        })?;
        Ok(home.join(APP_STATE_DIR).join(APP_STATE_FILE))
    }

    pub fn load_app_state() -> StorageResult<AppState> {
        let path = Self::app_state_path()?;
        if !path.exists() {
            return Ok(AppState::default());
        }
        let raw: serde_json::Value = read_json(&path)?;
        let raw_version = raw
            .get("schema_version")
            .and_then(|v| v.as_u64())
            .unwrap_or(1) as u32;
        let migrated = migrate_app_state_if_needed(raw, &path)?;
        let state: AppState = serde_json::from_value(migrated)?;
        // Persist if migration ran (raw version was older)
        if raw_version < opennote_core::settings::CURRENT_APP_STATE_VERSION {
            atomic_write_json(&path, &state)?;
        }
        Ok(state)
    }

    pub fn save_app_state(state: &AppState) -> StorageResult<()> {
        let path = Self::app_state_path()?;
        atomic_write_json(&path, state)
    }

    // ─── Workspace ───

    pub fn create_workspace(root_path: &Path, name: &str) -> StorageResult<Workspace> {
        let workspace = Workspace::new(name, root_path.to_path_buf())?;

        fs::create_dir_all(root_path)?;
        let ws_file = root_path.join(WORKSPACE_FILE);
        atomic_write_json(&ws_file, &workspace)?;

        let trash_dir = root_path.join(TRASH_DIR);
        fs::create_dir_all(&trash_dir)?;
        let manifest = TrashManifest::new();
        atomic_write_json(&trash_dir.join(TRASH_MANIFEST_FILE), &manifest)?;

        Ok(workspace)
    }

    pub fn load_workspace(root_path: &Path) -> StorageResult<Workspace> {
        let ws_file = root_path.join(WORKSPACE_FILE);
        if !ws_file.exists() {
            return Err(StorageError::WorkspaceNotFound {
                path: root_path.to_path_buf(),
            });
        }
        read_json(&ws_file)
    }

    pub fn save_workspace(workspace: &Workspace) -> StorageResult<()> {
        let ws_file = workspace.root_path.join(WORKSPACE_FILE);
        atomic_write_json(&ws_file, workspace)
    }

    pub fn open_workspace(root_path: &Path) -> StorageResult<Workspace> {
        lock::acquire_lock(root_path)?;
        let mut workspace = Self::load_workspace(root_path)?;
        workspace.updated_at = Utc::now();
        Self::save_workspace(&workspace)?;

        Self::cleanup_expired_trash(root_path)?;

        Ok(workspace)
    }

    pub fn close_workspace(root_path: &Path) -> StorageResult<()> {
        lock::release_lock(root_path)
    }

    // ─── Notebook ───

    pub fn list_notebooks(workspace_root: &Path) -> StorageResult<Vec<Notebook>> {
        let mut notebooks = Vec::new();
        for entry in fs::read_dir(workspace_root)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() && !is_hidden(&path) {
                let nb_file = path.join(NOTEBOOK_FILE);
                if nb_file.exists() {
                    let nb: Notebook = read_json(&nb_file)?;
                    notebooks.push(nb);
                }
            }
        }
        notebooks.sort_by_key(|nb| nb.order);
        Ok(notebooks)
    }

    pub fn create_notebook(workspace_root: &Path, name: &str) -> StorageResult<Notebook> {
        let existing_slugs = Self::existing_dir_slugs(workspace_root)?;
        let slug = unique_slug(name, &existing_slugs);
        let nb_dir = workspace_root.join(&slug);

        if nb_dir.exists() {
            return Err(StorageError::NotebookAlreadyExists {
                name: name.to_string(),
            });
        }

        let notebooks = Self::list_notebooks(workspace_root)?;
        let order = notebooks.len() as u32;
        let notebook = Notebook::new(name, order)?;

        fs::create_dir_all(&nb_dir)?;
        atomic_write_json(&nb_dir.join(NOTEBOOK_FILE), &notebook)?;

        Ok(notebook)
    }

    pub fn update_notebook(workspace_root: &Path, notebook: &Notebook) -> StorageResult<()> {
        let nb_dir = Self::find_notebook_dir(workspace_root, notebook.id)?;
        atomic_write_json(&nb_dir.join(NOTEBOOK_FILE), notebook)
    }

    pub fn rename_notebook(
        workspace_root: &Path,
        notebook_id: NotebookId,
        new_name: &str,
    ) -> StorageResult<Notebook> {
        let old_dir = Self::find_notebook_dir(workspace_root, notebook_id)?;
        let mut notebook: Notebook = read_json(&old_dir.join(NOTEBOOK_FILE))?;
        notebook.rename(new_name)?;

        let existing = Self::existing_dir_slugs(workspace_root)?;
        let new_slug = unique_slug(new_name, &existing);
        let new_dir = workspace_root.join(&new_slug);

        if old_dir != new_dir {
            fs::rename(&old_dir, &new_dir)?;
        }
        atomic_write_json(&new_dir.join(NOTEBOOK_FILE), &notebook)?;

        Ok(notebook)
    }

    pub fn delete_notebook(workspace_root: &Path, notebook_id: NotebookId) -> StorageResult<()> {
        let nb_dir = Self::find_notebook_dir(workspace_root, notebook_id)?;
        let notebook: Notebook = read_json(&nb_dir.join(NOTEBOOK_FILE))?;

        let size = dir_size(&nb_dir)?;
        let trash_item = TrashItem::new(
            TrashItemType::Notebook,
            notebook.name.clone(),
            nb_dir
                .strip_prefix(workspace_root)
                .unwrap_or(&nb_dir)
                .to_string_lossy()
                .to_string(),
            notebook.name,
            None,
            size,
        );

        Self::move_to_trash(workspace_root, &nb_dir, trash_item)?;
        Ok(())
    }

    pub fn reorder_notebooks(
        workspace_root: &Path,
        order: &[(NotebookId, u32)],
    ) -> StorageResult<()> {
        for (id, new_order) in order {
            let nb_dir = Self::find_notebook_dir(workspace_root, *id)?;
            let mut nb: Notebook = read_json(&nb_dir.join(NOTEBOOK_FILE))?;
            nb.order = *new_order;
            nb.updated_at = Utc::now();
            atomic_write_json(&nb_dir.join(NOTEBOOK_FILE), &nb)?;
        }
        Ok(())
    }

    // ─── Section ───

    pub fn list_sections(
        workspace_root: &Path,
        notebook_id: NotebookId,
    ) -> StorageResult<Vec<Section>> {
        let nb_dir = Self::find_notebook_dir(workspace_root, notebook_id)?;
        let mut sections = Vec::new();
        for entry in fs::read_dir(&nb_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() && !is_hidden(&path) {
                let sec_file = path.join(SECTION_FILE);
                if sec_file.exists() {
                    let sec: Section = read_json(&sec_file)?;
                    sections.push(sec);
                }
            }
        }
        sections.sort_by_key(|s| s.order);
        Ok(sections)
    }

    pub fn create_section(
        workspace_root: &Path,
        notebook_id: NotebookId,
        name: &str,
    ) -> StorageResult<Section> {
        let nb_dir = Self::find_notebook_dir(workspace_root, notebook_id)?;
        let existing_slugs = Self::existing_dir_slugs(&nb_dir)?;
        let slug = unique_slug(name, &existing_slugs);
        let sec_dir = nb_dir.join(&slug);

        let sections = Self::list_sections(workspace_root, notebook_id)?;
        let order = sections.len() as u32;
        let section = Section::new(notebook_id, name, order)?;

        fs::create_dir_all(&sec_dir)?;
        fs::create_dir_all(sec_dir.join(ASSETS_DIR))?;
        atomic_write_json(&sec_dir.join(SECTION_FILE), &section)?;

        Ok(section)
    }

    pub fn rename_section(
        workspace_root: &Path,
        section_id: SectionId,
        new_name: &str,
    ) -> StorageResult<Section> {
        let (nb_dir, old_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let mut section: Section = read_json(&old_dir.join(SECTION_FILE))?;
        section.rename(new_name)?;

        let existing = Self::existing_dir_slugs(&nb_dir)?;
        let new_slug = unique_slug(new_name, &existing);
        let new_dir = nb_dir.join(&new_slug);

        if old_dir != new_dir {
            fs::rename(&old_dir, &new_dir)?;
        }
        atomic_write_json(&new_dir.join(SECTION_FILE), &section)?;

        Ok(section)
    }

    pub fn delete_section(workspace_root: &Path, section_id: SectionId) -> StorageResult<()> {
        let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let section: Section = read_json(&sec_dir.join(SECTION_FILE))?;

        let nb_dir_path = sec_dir.parent().unwrap();
        let notebook: Notebook = read_json(&nb_dir_path.join(NOTEBOOK_FILE))?;

        let size = dir_size(&sec_dir)?;
        let trash_item = TrashItem::new(
            TrashItemType::Section,
            section.name.clone(),
            sec_dir
                .strip_prefix(workspace_root)
                .unwrap_or(&sec_dir)
                .to_string_lossy()
                .to_string(),
            notebook.name,
            Some(section.name),
            size,
        );

        Self::move_to_trash(workspace_root, &sec_dir, trash_item)?;
        Ok(())
    }

    pub fn reorder_sections(
        workspace_root: &Path,
        order: &[(SectionId, u32)],
    ) -> StorageResult<()> {
        for (id, new_order) in order {
            let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, *id)?;
            let mut sec: Section = read_json(&sec_dir.join(SECTION_FILE))?;
            sec.order = *new_order;
            sec.updated_at = Utc::now();
            atomic_write_json(&sec_dir.join(SECTION_FILE), &sec)?;
        }
        Ok(())
    }

    // ─── Page ───

    pub fn list_pages(
        workspace_root: &Path,
        section_id: SectionId,
    ) -> StorageResult<Vec<PageSummary>> {
        let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let mut summaries = Vec::new();

        for entry in fs::read_dir(&sec_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() && path_has_extension(&path, PAGE_EXTENSION) {
                let page: Page = read_json(&path)?;
                summaries.push(PageSummary::from(&page));
            }
        }

        summaries.sort_by(|a, b| a.updated_at.cmp(&b.updated_at).reverse());
        Ok(summaries)
    }

    pub fn load_page(workspace_root: &Path, page_id: PageId) -> StorageResult<Page> {
        let path = Self::find_page_file(workspace_root, page_id)?;
        let raw: serde_json::Value = read_json(&path)?;
        let raw_version = raw
            .get("schema_version")
            .and_then(|v| v.as_u64())
            .unwrap_or(1) as u32;

        let migrated = crate::migrations::migrate_page_if_needed(raw)?;
        let page: Page = serde_json::from_value(migrated)?;

        // Re-salva apenas se houve migration
        if raw_version < opennote_core::page::CURRENT_SCHEMA_VERSION {
            atomic_write_json(&path, &page)?;
        }
        Ok(page)
    }

    pub fn create_page(
        workspace_root: &Path,
        section_id: SectionId,
        title: &str,
    ) -> StorageResult<Page> {
        let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;

        let existing_slugs = Self::existing_page_slugs(&sec_dir)?;
        let slug = unique_slug(title, &existing_slugs);
        let page_path = sec_dir.join(format!("{slug}.{PAGE_EXTENSION}"));

        let page = Page::new(section_id, title)?;
        atomic_write_json(&page_path, &page)?;

        Ok(page)
    }

    pub fn create_page_from(
        workspace_root: &Path,
        section_id: SectionId,
        page: Page,
    ) -> StorageResult<Page> {
        let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let existing_slugs = Self::existing_page_slugs(&sec_dir)?;
        let slug = unique_slug(&page.title, &existing_slugs);
        let page_path = sec_dir.join(format!("{slug}.{PAGE_EXTENSION}"));
        atomic_write_json(&page_path, &page)?;
        Ok(page)
    }

    pub fn update_page(workspace_root: &Path, page: &Page) -> StorageResult<()> {
        let path = Self::find_page_file(workspace_root, page.id)?;
        atomic_write_json(&path, page)
    }

    pub fn delete_page(workspace_root: &Path, page_id: PageId) -> StorageResult<()> {
        let page_path = Self::find_page_file(workspace_root, page_id)?;
        let page: Page = read_json(&page_path)?;

        let sec_dir = page_path.parent().unwrap();
        let section: Section = read_json(&sec_dir.join(SECTION_FILE))?;
        let nb_dir = sec_dir.parent().unwrap();
        let notebook: Notebook = read_json(&nb_dir.join(NOTEBOOK_FILE))?;

        let size = fs::metadata(&page_path)?.len();
        let trash_item = TrashItem::new(
            TrashItemType::Page,
            page.title.clone(),
            page_path
                .strip_prefix(workspace_root)
                .unwrap_or(&page_path)
                .to_string_lossy()
                .to_string(),
            notebook.name,
            Some(section.name),
            size,
        );

        let trash_dir = workspace_root.join(TRASH_DIR);
        fs::create_dir_all(&trash_dir)?;

        let item_dir = trash_dir.join(&trash_item.id);
        fs::create_dir_all(&item_dir)?;

        let file_name = page_path.file_name().unwrap();
        fs::rename(&page_path, item_dir.join(file_name))?;

        let mut manifest = Self::load_trash_manifest(workspace_root)?;
        manifest.add_item(trash_item);
        Self::save_trash_manifest(workspace_root, &manifest)?;

        Ok(())
    }

    pub fn move_page(
        workspace_root: &Path,
        page_id: PageId,
        target_section_id: SectionId,
    ) -> StorageResult<Page> {
        let old_path = Self::find_page_file(workspace_root, page_id)?;
        let mut page: Page = read_json(&old_path)?;

        let (_nb_dir, target_sec_dir) = Self::find_section_dir(workspace_root, target_section_id)?;

        let existing_slugs = Self::existing_page_slugs(&target_sec_dir)?;
        let slug = unique_slug(&page.title, &existing_slugs);
        let new_path = target_sec_dir.join(format!("{slug}.{PAGE_EXTENSION}"));

        page.section_id = target_section_id;
        page.updated_at = Utc::now();

        atomic_write_json(&new_path, &page)?;
        fs::remove_file(&old_path)?;

        Ok(page)
    }

    pub fn move_section(
        workspace_root: &Path,
        section_id: SectionId,
        target_notebook_id: NotebookId,
    ) -> StorageResult<Section> {
        let (src_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let target_nb_dir = Self::find_notebook_dir(workspace_root, target_notebook_id)?;

        let mut section: Section = read_json(&sec_dir.join(SECTION_FILE))?;

        if src_nb_dir == target_nb_dir {
            return Ok(section);
        }

        let existing_slugs = Self::existing_dir_slugs(&target_nb_dir)?;
        let slug = unique_slug(&section.name, &existing_slugs);
        let new_sec_dir = target_nb_dir.join(&slug);

        section.notebook_id = target_notebook_id;
        section.updated_at = Utc::now();

        fs::rename(&sec_dir, &new_sec_dir)?;
        atomic_write_json(&new_sec_dir.join(SECTION_FILE), &section)?;

        Ok(section)
    }

    // ─── Assets ───

    pub fn import_asset(
        workspace_root: &Path,
        section_id: SectionId,
        source_path: &Path,
    ) -> StorageResult<String> {
        let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let assets_dir = sec_dir.join(ASSETS_DIR);
        fs::create_dir_all(&assets_dir)?;

        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let asset_name = format!("{}.{ext}", uuid::Uuid::new_v4());
        let dest = assets_dir.join(&asset_name);

        fs::copy(source_path, &dest)?;

        let relative = dest
            .strip_prefix(workspace_root)
            .unwrap_or(&dest)
            .to_string_lossy()
            .to_string();
        Ok(relative)
    }

    pub fn import_asset_from_bytes(
        workspace_root: &Path,
        section_id: SectionId,
        bytes: &[u8],
        ext: &str,
    ) -> StorageResult<String> {
        let (_nb_dir, sec_dir) = Self::find_section_dir(workspace_root, section_id)?;
        let assets_dir = sec_dir.join(ASSETS_DIR);
        fs::create_dir_all(&assets_dir)?;

        let asset_name = format!("{}.{ext}", uuid::Uuid::new_v4());
        let dest = assets_dir.join(&asset_name);

        fs::write(&dest, bytes)?;

        let relative = dest
            .strip_prefix(workspace_root)
            .unwrap_or(&dest)
            .to_string_lossy()
            .to_string();
        Ok(relative)
    }

    pub fn delete_asset(workspace_root: &Path, asset_path: &str) -> StorageResult<()> {
        let full_path = workspace_root.join(asset_path);
        if full_path.exists() {
            fs::remove_file(&full_path)?;
        }
        Ok(())
    }

    // ─── Trash ───

    pub fn load_trash_manifest(workspace_root: &Path) -> StorageResult<TrashManifest> {
        let path = workspace_root.join(TRASH_DIR).join(TRASH_MANIFEST_FILE);
        if !path.exists() {
            return Ok(TrashManifest::new());
        }
        read_json(&path)
    }

    pub fn save_trash_manifest(
        workspace_root: &Path,
        manifest: &TrashManifest,
    ) -> StorageResult<()> {
        let trash_dir = workspace_root.join(TRASH_DIR);
        fs::create_dir_all(&trash_dir)?;
        atomic_write_json(&trash_dir.join(TRASH_MANIFEST_FILE), manifest)
    }

    pub fn list_trash_items(workspace_root: &Path) -> StorageResult<Vec<TrashItem>> {
        let manifest = Self::load_trash_manifest(workspace_root)?;
        Ok(manifest.items)
    }

    pub fn restore_from_trash(workspace_root: &Path, trash_item_id: &str) -> StorageResult<()> {
        let mut manifest = Self::load_trash_manifest(workspace_root)?;
        let item =
            manifest
                .remove_item(trash_item_id)
                .ok_or_else(|| StorageError::TrashItemNotFound {
                    id: trash_item_id.to_string(),
                })?;

        let trash_item_dir = workspace_root.join(TRASH_DIR).join(&item.id);
        let restore_path = workspace_root.join(&item.original_path);

        if let Some(parent) = restore_path.parent() {
            fs::create_dir_all(parent)?;
        }

        match item.item_type {
            TrashItemType::Page => {
                if let Some(file_name) = restore_path.file_name() {
                    let src = trash_item_dir.join(file_name);
                    if src.exists() {
                        fs::rename(&src, &restore_path)?;
                    }
                }
            }
            TrashItemType::Section | TrashItemType::Notebook => {
                if trash_item_dir.exists() {
                    move_dir_contents(&trash_item_dir, &restore_path)?;
                }
            }
        }

        if trash_item_dir.exists() {
            fs::remove_dir_all(&trash_item_dir)?;
        }

        Self::save_trash_manifest(workspace_root, &manifest)?;
        Ok(())
    }

    pub fn permanently_delete(workspace_root: &Path, trash_item_id: &str) -> StorageResult<()> {
        let mut manifest = Self::load_trash_manifest(workspace_root)?;
        let item =
            manifest
                .remove_item(trash_item_id)
                .ok_or_else(|| StorageError::TrashItemNotFound {
                    id: trash_item_id.to_string(),
                })?;

        let trash_item_dir = workspace_root.join(TRASH_DIR).join(&item.id);
        if trash_item_dir.exists() {
            fs::remove_dir_all(&trash_item_dir)?;
        }

        Self::save_trash_manifest(workspace_root, &manifest)?;
        Ok(())
    }

    pub fn empty_trash(workspace_root: &Path) -> StorageResult<()> {
        let trash_dir = workspace_root.join(TRASH_DIR);
        if trash_dir.exists() {
            fs::remove_dir_all(&trash_dir)?;
        }
        fs::create_dir_all(&trash_dir)?;
        Self::save_trash_manifest(workspace_root, &TrashManifest::new())?;
        Ok(())
    }

    pub fn cleanup_expired_trash(workspace_root: &Path) -> StorageResult<u32> {
        let mut manifest = Self::load_trash_manifest(workspace_root)?;
        let expired = manifest.remove_expired(Utc::now());
        let count = expired.len() as u32;

        for item in &expired {
            let item_dir = workspace_root.join(TRASH_DIR).join(&item.id);
            if item_dir.exists() {
                let _ = fs::remove_dir_all(&item_dir);
            }
        }

        if count > 0 {
            Self::save_trash_manifest(workspace_root, &manifest)?;
        }

        Ok(count)
    }

    // ─── Tags ───

    pub fn list_all_tags(workspace_root: &Path) -> StorageResult<Vec<String>> {
        let mut tags = HashSet::new();
        for nb_entry in fs::read_dir(workspace_root)? {
            let nb_entry = nb_entry?;
            let nb_path = nb_entry.path();
            if !nb_path.is_dir() || is_hidden(&nb_path) || !nb_path.join(NOTEBOOK_FILE).exists() {
                continue;
            }
            for sec_entry in fs::read_dir(&nb_path)? {
                let sec_entry = sec_entry?;
                let sec_path = sec_entry.path();
                if !sec_path.is_dir() || is_hidden(&sec_path) {
                    continue;
                }
                for page_entry in fs::read_dir(&sec_path)? {
                    let page_entry = page_entry?;
                    let page_path = page_entry.path();
                    if page_path.is_file() && path_has_extension(&page_path, PAGE_EXTENSION) {
                        if let Ok(page) = read_json::<Page>(&page_path) {
                            for tag in &page.tags {
                                tags.insert(tag.clone());
                            }
                        }
                    }
                }
            }
        }
        let mut sorted: Vec<String> = tags.into_iter().collect();
        sorted.sort();
        Ok(sorted)
    }

    // ─── Helpers ───

    fn find_notebook_dir(workspace_root: &Path, notebook_id: NotebookId) -> StorageResult<PathBuf> {
        for entry in fs::read_dir(workspace_root)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() && !is_hidden(&path) {
                let nb_file = path.join(NOTEBOOK_FILE);
                if nb_file.exists() {
                    let nb: Notebook = read_json(&nb_file)?;
                    if nb.id == notebook_id {
                        return Ok(path);
                    }
                }
            }
        }
        Err(StorageError::NotebookNotFound {
            name: notebook_id.to_string(),
        })
    }

    pub fn find_section_dir(
        workspace_root: &Path,
        section_id: SectionId,
    ) -> StorageResult<(PathBuf, PathBuf)> {
        for nb_entry in fs::read_dir(workspace_root)? {
            let nb_entry = nb_entry?;
            let nb_path = nb_entry.path();
            if !nb_path.is_dir() || is_hidden(&nb_path) {
                continue;
            }
            if !nb_path.join(NOTEBOOK_FILE).exists() {
                continue;
            }

            for sec_entry in fs::read_dir(&nb_path)? {
                let sec_entry = sec_entry?;
                let sec_path = sec_entry.path();
                if sec_path.is_dir() && !is_hidden(&sec_path) {
                    let sec_file = sec_path.join(SECTION_FILE);
                    if sec_file.exists() {
                        let sec: Section = read_json(&sec_file)?;
                        if sec.id == section_id {
                            return Ok((nb_path, sec_path));
                        }
                    }
                }
            }
        }
        Err(StorageError::SectionNotFound {
            name: section_id.to_string(),
        })
    }

    fn find_page_file(workspace_root: &Path, page_id: PageId) -> StorageResult<PathBuf> {
        for nb_entry in fs::read_dir(workspace_root)? {
            let nb_entry = nb_entry?;
            let nb_path = nb_entry.path();
            if !nb_path.is_dir() || is_hidden(&nb_path) {
                continue;
            }
            if !nb_path.join(NOTEBOOK_FILE).exists() {
                continue;
            }

            for sec_entry in fs::read_dir(&nb_path)? {
                let sec_entry = sec_entry?;
                let sec_path = sec_entry.path();
                if !sec_path.is_dir() || is_hidden(&sec_path) {
                    continue;
                }

                for page_entry in fs::read_dir(&sec_path)? {
                    let page_entry = page_entry?;
                    let page_path = page_entry.path();
                    if page_path.is_file() && path_has_extension(&page_path, PAGE_EXTENSION) {
                        let page: Page = read_json(&page_path)?;
                        if page.id == page_id {
                            return Ok(page_path);
                        }
                    }
                }
            }
        }
        Err(StorageError::PageNotFound { id: page_id })
    }

    fn existing_dir_slugs(parent: &Path) -> StorageResult<HashSet<String>> {
        let mut slugs = HashSet::new();
        if parent.exists() {
            for entry in fs::read_dir(parent)? {
                let entry = entry?;
                if entry.path().is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        slugs.insert(name.to_string());
                    }
                }
            }
        }
        Ok(slugs)
    }

    fn existing_page_slugs(section_dir: &Path) -> StorageResult<HashSet<String>> {
        let mut slugs = HashSet::new();
        if section_dir.exists() {
            for entry in fs::read_dir(section_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() && path_has_extension(&path, PAGE_EXTENSION) {
                    if let Some(stem) = path.file_name().and_then(|n| n.to_str()) {
                        let slug = stem
                            .strip_suffix(&format!(".{PAGE_EXTENSION}"))
                            .unwrap_or(stem)
                            .to_string();
                        slugs.insert(slug);
                    }
                }
            }
        }
        Ok(slugs)
    }

    fn move_to_trash(
        workspace_root: &Path,
        source: &Path,
        trash_item: TrashItem,
    ) -> StorageResult<()> {
        let trash_dir = workspace_root.join(TRASH_DIR);
        fs::create_dir_all(&trash_dir)?;

        let item_dir = trash_dir.join(&trash_item.id);
        fs::rename(source, &item_dir)?;

        let mut manifest = Self::load_trash_manifest(workspace_root)?;
        manifest.add_item(trash_item);
        Self::save_trash_manifest(workspace_root, &manifest)?;

        Ok(())
    }
}

// ─── Free functions ───

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.starts_with('.'))
        .unwrap_or(false)
}

fn path_has_extension(path: &Path, ext: &str) -> bool {
    path.to_str()
        .map(|s| s.ends_with(&format!(".{ext}")))
        .unwrap_or(false)
}

fn dir_size(path: &Path) -> StorageResult<u64> {
    let mut total = 0u64;
    if path.is_file() {
        return Ok(fs::metadata(path)?.len());
    }
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let p = entry.path();
        if p.is_file() {
            total += fs::metadata(&p)?.len();
        } else if p.is_dir() {
            total += dir_size(&p)?;
        }
    }
    Ok(total)
}

fn move_dir_contents(src: &Path, dest: &Path) -> StorageResult<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            move_dir_contents(&src_path, &dest_path)?;
        } else {
            fs::rename(&src_path, &dest_path)?;
        }
    }
    Ok(())
}

fn dirs_home() -> Option<PathBuf> {
    #[cfg(unix)]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
    #[cfg(not(unix))]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
}
