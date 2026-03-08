pub mod dropbox;
pub mod google_drive;
pub mod onedrive;

use crate::provider::SyncProvider;
use crate::types::SyncProviderType;

pub fn create_provider(provider_type: SyncProviderType) -> Box<dyn SyncProvider> {
    match provider_type {
        SyncProviderType::GoogleDrive => Box::new(google_drive::GoogleDriveProvider::new()),
        SyncProviderType::OneDrive => Box::new(onedrive::OneDriveProvider::new()),
        SyncProviderType::Dropbox => Box::new(dropbox::DropboxProvider::new()),
    }
}
