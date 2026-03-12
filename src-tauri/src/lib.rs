mod commands;
mod error;
mod state;

use commands::assets::{delete_asset, import_asset, import_asset_from_bytes, read_asset_base64};
use commands::get_app_info;
use commands::notebook::{
    create_notebook, delete_notebook, list_notebooks, rename_notebook, reorder_notebooks,
};
use commands::page::{
    change_page_password, create_canvas_page, create_page, create_pdf_canvas_page, delete_page,
    get_random_pages, import_pdf, list_pages, load_page, lock_page, move_page, read_file_content,
    remove_page_password, save_file_content, set_page_password, unlock_page, update_page,
    update_page_annotations, update_page_blocks, update_page_canvas_state,
};
use commands::search::{
    get_index_status, quick_open, rebuild_index, reindex_page, search_all_workspaces, search_pages,
};
use commands::section::{
    create_section, delete_section, list_sections, move_section, rename_section, reorder_sections,
};
use commands::spellcheck::check_spelling;
use commands::sync::{
    connect_provider, disconnect_provider, disconnect_provider_by_name, download_workspace,
    get_provider_status, get_sync_config, get_sync_conflicts, get_sync_providers, get_sync_status,
    list_remote_workspaces, resolve_sync_conflict, set_sync_config, sync_bidirectional,
    sync_initial_upload,
};
use commands::tags::list_all_tags;
use commands::template::{
    create_page_from_template, create_template_from_page, delete_template, list_templates,
};
use commands::trash::{empty_trash, list_trash_items, permanently_delete, restore_from_trash};
use commands::workspace::{
    close_workspace, create_workspace, ensure_quick_notes, focus_workspace, force_open_workspace,
    get_app_state, get_global_settings, get_workspace_settings, list_open_workspaces,
    open_workspace, remove_recent_workspace, switch_workspace, update_global_settings,
    update_workspace_settings,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .level_for("opennote_core", log::LevelFilter::Debug)
                .level_for("opennote_storage", log::LevelFilter::Debug)
                .level_for("opennote_search", log::LevelFilter::Debug)
                .level_for("opennote_sync", log::LevelFilter::Debug)
                .level_for("open_note", log::LevelFilter::Debug)
                .build(),
        )
        .manage(state::AppManagedState::new())
        .invoke_handler(tauri::generate_handler![
            // App
            get_app_info,
            get_app_state,
            // Workspace
            create_workspace,
            open_workspace,
            force_open_workspace,
            close_workspace,
            list_open_workspaces,
            focus_workspace,
            switch_workspace,
            remove_recent_workspace,
            get_workspace_settings,
            update_workspace_settings,
            get_global_settings,
            update_global_settings,
            ensure_quick_notes,
            // Notebook
            list_notebooks,
            create_notebook,
            rename_notebook,
            delete_notebook,
            reorder_notebooks,
            // Section
            list_sections,
            create_section,
            rename_section,
            delete_section,
            reorder_sections,
            move_section,
            // Page
            list_pages,
            load_page,
            unlock_page,
            lock_page,
            set_page_password,
            remove_page_password,
            change_page_password,
            create_page,
            update_page,
            update_page_blocks,
            update_page_annotations,
            update_page_canvas_state,
            delete_page,
            move_page,
            create_pdf_canvas_page,
            create_canvas_page,
            get_random_pages,
            // Templates
            list_templates,
            create_template_from_page,
            delete_template,
            create_page_from_template,
            // File I/O
            read_file_content,
            save_file_content,
            // PDF
            import_pdf,
            // Trash
            list_trash_items,
            restore_from_trash,
            permanently_delete,
            empty_trash,
            // Tags
            list_all_tags,
            // Assets
            import_asset,
            import_asset_from_bytes,
            read_asset_base64,
            delete_asset,
            // Search
            search_pages,
            quick_open,
            reindex_page,
            rebuild_index,
            get_index_status,
            search_all_workspaces,
            // Sync
            connect_provider,
            disconnect_provider,
            disconnect_provider_by_name,
            get_provider_status,
            sync_initial_upload,
            sync_bidirectional,
            list_remote_workspaces,
            download_workspace,
            get_sync_providers,
            get_sync_status,
            get_sync_config,
            set_sync_config,
            get_sync_conflicts,
            resolve_sync_conflict,
            // Spell Check
            check_spelling,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
