#[cfg(test)]
mod tests {
    use crate::commands::page::*;
    use crate::error::CommandError;
    use crate::state::{AppManagedState, WorkspaceContext};
    use opennote_core::id::{SectionId, WorkspaceId};
    use opennote_core::page::PROTECTED_TITLE_PLACEHOLDER;
    use opennote_storage::engine::FsStorageEngine;
    use std::path::PathBuf;
    use tempfile::tempdir;

    fn setup_state(root: PathBuf) -> AppManagedState {
        let state = AppManagedState::new();
        let ws_id = WorkspaceId::new();
        let name = "Test Workspace".to_string();
        let ctx = WorkspaceContext::new(root, name);
        state.register_workspace(ws_id, ctx).unwrap();
        state.set_focused(Some(ws_id)).unwrap();
        state
    }

    fn create_real_section(root: &std::path::Path) -> SectionId {
        let notebook = FsStorageEngine::create_notebook(root, "Test Notebook").unwrap();
        let section = FsStorageEngine::create_section(root, notebook.id, "Test Section").unwrap();
        section.id
    }

    #[tokio::test]
    async fn test_page_protection_lifecycle() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let state = setup_state(root.clone());

        // 1. Criar notebook e seção real
        let section_id = create_real_section(&root);

        // 2. Criar página
        let page = create_page_internal(&state, section_id, "Secret".into(), None).unwrap();
        let page_id = page.id;

        // 3. Set password
        set_page_password_internal(&state, page_id, "pass123".into(), None).unwrap();

        // 4. Verificar que no disco está bloqueada (via load_page sem cache)
        let ws_id = state.get_focused_id().unwrap().unwrap();
        state
            .with_workspace_mut(&ws_id, |ctx| {
                ctx.session_keys.clear();
                Ok(())
            })
            .unwrap();

        let loaded_locked = load_page_internal(&state, page_id, None).unwrap();
        assert!(loaded_locked.protection.is_some());
        assert_eq!(loaded_locked.title, PROTECTED_TITLE_PLACEHOLDER);
        assert!(loaded_locked.blocks.is_empty());

        // 4. Unlock
        let unlocked = unlock_page_internal(&state, page_id, "pass123".into(), None, None).unwrap();

        assert_eq!(unlocked.title, "Secret");
        assert!(unlocked.protection.is_some());

        // 6. Update blocks
        let new_blocks = vec![];
        let updated = update_page_blocks_internal(&state, page_id, new_blocks, None).unwrap();
        // O comando agora retorna a versão descriptografada para o frontend
        assert_eq!(updated.title, "Secret");

        let loaded_unlocked = load_page_internal(&state, page_id, None).unwrap();
        assert_eq!(loaded_unlocked.title, "Secret");

        // 7. Remove password
        remove_page_password_internal(&state, page_id, "pass123".into(), None).unwrap();

        let final_page = load_page_internal(&state, page_id, None).unwrap();
        assert!(final_page.protection.is_none());
        assert_eq!(final_page.title, "Secret");
    }

    #[tokio::test]
    async fn test_wrong_password_returns_error() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let state = setup_state(root.clone());

        let section_id = create_real_section(&root);
        let page = create_page_internal(&state, section_id, "Secret".into(), None).unwrap();

        set_page_password_internal(&state, page.id, "correct".into(), None).unwrap();

        // Limpar cache
        let ws_id = state.get_focused_id().unwrap().unwrap();
        state
            .with_workspace_mut(&ws_id, |ctx| {
                ctx.session_keys.clear();
                Ok(())
            })
            .unwrap();

        let result = unlock_page_internal(&state, page.id, "wrong".into(), None, None);
        assert!(result.is_err());
        if let Err(CommandError::Validation(msg)) = result {
            assert_eq!(msg, "WRONG_PASSWORD");
        } else {
            panic!("Expected WRONG_PASSWORD error, got {:?}", result);
        }
    }

    #[tokio::test]
    async fn test_page_unlock_expiration() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let state = setup_state(root.clone());

        let section_id = create_real_section(&root);
        let page = create_page_internal(&state, section_id, "Secret".into(), None).unwrap();

        set_page_password_internal(&state, page.id, "password123".into(), None).unwrap();

        // 1. Unlock com 0 minutos (expira imediatamente ou quase)
        unlock_page_internal(&state, page.id, "password123".into(), Some(0), None).unwrap();

        // Simular passagem de tempo ou apenas verificar que limpa se expirado
        // get_cached_key deve limpar se < now
        let key = state.get_cached_key(page.id).unwrap();
        assert!(key.is_none(), "Key should have expired");
    }
}
