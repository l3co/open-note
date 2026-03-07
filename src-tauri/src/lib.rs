mod commands;
mod state;

use commands::assets::{delete_asset, import_asset, import_asset_from_bytes};
use commands::get_app_info;
use commands::notebook::{
    create_notebook, delete_notebook, list_notebooks, rename_notebook, reorder_notebooks,
};
use commands::page::{
    create_page, delete_page, list_pages, load_page, move_page, update_page, update_page_blocks,
};
use commands::section::{
    create_section, delete_section, list_sections, rename_section, reorder_sections,
};
use commands::tags::list_all_tags;
use commands::trash::{empty_trash, list_trash_items, permanently_delete, restore_from_trash};
use commands::workspace::{
    close_workspace, create_workspace, get_app_state, get_global_settings, get_workspace_settings,
    open_workspace, remove_recent_workspace, update_global_settings, update_workspace_settings,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state::AppManagedState::new())
        .invoke_handler(tauri::generate_handler![
            // App
            get_app_info,
            get_app_state,
            // Workspace
            create_workspace,
            open_workspace,
            close_workspace,
            remove_recent_workspace,
            get_workspace_settings,
            update_workspace_settings,
            get_global_settings,
            update_global_settings,
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
            // Page
            list_pages,
            load_page,
            create_page,
            update_page,
            update_page_blocks,
            delete_page,
            move_page,
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
            delete_asset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
