pub mod dropbox;
pub mod google_drive;
pub mod onedrive;

use crate::provider::SyncProvider;
use crate::types::SyncProviderType;

pub fn create_provider(provider_type: SyncProviderType) -> Box<dyn SyncProvider> {
    match provider_type {
        SyncProviderType::GoogleDrive => {
            Box::new(google_drive::GoogleDriveProvider::with_env_credentials())
        }
        SyncProviderType::OneDrive => Box::new(onedrive::OneDriveProvider::with_env_credentials()),
        SyncProviderType::Dropbox => Box::new(dropbox::DropboxProvider::with_env_credentials()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::SyncProvider;

    #[test]
    fn create_provider_google_drive_returns_correct_type() {
        let p = create_provider(SyncProviderType::GoogleDrive);
        assert_eq!(p.name(), "google_drive");
        assert_eq!(p.provider_type(), SyncProviderType::GoogleDrive);
        assert_eq!(p.display_name(), "Google Drive");
    }

    #[test]
    fn create_provider_onedrive_returns_correct_type() {
        let p = create_provider(SyncProviderType::OneDrive);
        assert_eq!(p.name(), "onedrive");
        assert_eq!(p.provider_type(), SyncProviderType::OneDrive);
        assert_eq!(p.display_name(), "OneDrive");
    }

    #[test]
    fn create_provider_dropbox_returns_correct_type() {
        let p = create_provider(SyncProviderType::Dropbox);
        assert_eq!(p.name(), "dropbox");
        assert_eq!(p.provider_type(), SyncProviderType::Dropbox);
        assert_eq!(p.display_name(), "Dropbox");
    }
}
