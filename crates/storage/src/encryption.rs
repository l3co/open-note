use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};

use crate::error::{StorageError, StorageResult};
use opennote_core::annotation::PageAnnotations;
use opennote_core::block::Block;
use opennote_core::page::{EncryptionAlgorithm, KdfParams, KeyDerivationFunction, PageProtection};

const KEY_LEN: usize = 32; // AES-256
const SALT_LEN: usize = 16; // 128 bits
const NONCE_LEN: usize = 12; // 96 bits AES-GCM

/// Payload completo serializado e depois criptografado.
/// Inclui título real, tags, blocks e annotations.
#[derive(Serialize, Deserialize)]
pub struct EncryptedPayload {
    pub title: String,
    pub tags: Vec<String>,
    pub blocks: Vec<Block>,
    pub annotations: PageAnnotations,
}

pub struct EncryptionService;

impl EncryptionService {
    /// Valida se a senha atende aos requisitos mínimos.
    pub fn validate_password(password: &str) -> StorageResult<()> {
        if password.len() < 6 {
            return Err(StorageError::EncryptionError(
                "Password must be at least 6 characters".into(),
            ));
        }
        Ok(())
    }

    /// Gera metadados de proteção novos (salt e nonce aleatórios).
    pub fn new_protection() -> StorageResult<PageProtection> {
        let mut salt = [0u8; SALT_LEN];
        let mut nonce = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut salt);
        OsRng.fill_bytes(&mut nonce);

        Ok(PageProtection {
            algorithm: EncryptionAlgorithm::AesGcm256,
            kdf: KeyDerivationFunction::Argon2id,
            kdf_params: KdfParams::default(),
            salt: B64.encode(salt),
            nonce: B64.encode(nonce),
        })
    }

    /// Deriva uma chave de 256 bits a partir da senha + metadados da proteção.
    pub fn derive_key(password: &str, protection: &PageProtection) -> StorageResult<Vec<u8>> {
        let salt = B64
            .decode(&protection.salt)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 salt".into()))?;
        let p = &protection.kdf_params;
        let params = Params::new(p.m_cost, p.t_cost, p.p_cost, Some(KEY_LEN))
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            Version::try_from(p.version)
                .map_err(|_| StorageError::EncryptionError("Invalid Argon2 version".into()))?,
            params,
        );
        let mut key = vec![0u8; KEY_LEN];
        argon2
            .hash_password_into(password.as_bytes(), &salt, &mut key)
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        Ok(key)
    }

    /// Criptografa o conteúdo JSON (plaintext) com a chave derivada.
    /// Retorna ciphertext codificado em base64.
    pub fn encrypt(
        plaintext: &[u8],
        key: &[u8],
        protection: &PageProtection,
    ) -> StorageResult<String> {
        let nonce_bytes = B64
            .decode(&protection.nonce)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 nonce".into()))?;
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|_| StorageError::EncryptionError("Encryption failed".into()))?;
        Ok(B64.encode(ciphertext))
    }

    /// Descriptografa ciphertext (base64) com a chave derivada.
    /// Retorna erro se a senha/chave for incorreta (autenticação AES-GCM falha).
    pub fn decrypt(
        ciphertext_b64: &str,
        key: &[u8],
        protection: &PageProtection,
    ) -> StorageResult<Vec<u8>> {
        let nonce_bytes = B64
            .decode(&protection.nonce)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 nonce".into()))?;
        let ciphertext = B64
            .decode(ciphertext_b64)
            .map_err(|_| StorageError::EncryptionError("Invalid base64 ciphertext".into()))?;
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| StorageError::EncryptionError(e.to_string()))?;
        let nonce = Nonce::from_slice(&nonce_bytes);
        cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| StorageError::WrongPassword)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use opennote_core::id::SectionId;
    use opennote_core::page::Page;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let page = Page::new(SectionId::new(), "Secret Page").unwrap();
        let payload = EncryptedPayload {
            title: page.title.clone(),
            tags: page.tags.clone(),
            blocks: page.blocks.clone(),
            annotations: page.annotations.clone(),
        };
        let plaintext = serde_json::to_vec(&payload).unwrap();

        let protection = EncryptionService::new_protection().unwrap();
        let key = EncryptionService::derive_key("password123", &protection).unwrap();

        let ciphertext = EncryptionService::encrypt(&plaintext, &key, &protection).unwrap();
        let decrypted = EncryptionService::decrypt(&ciphertext, &key, &protection).unwrap();

        assert_eq!(plaintext, decrypted);

        let decrypted_payload: EncryptedPayload = serde_json::from_slice(&decrypted).unwrap();
        assert_eq!(decrypted_payload.title, "Secret Page");
    }

    #[test]
    fn test_wrong_password_returns_error() {
        let protection = EncryptionService::new_protection().unwrap();
        let key = EncryptionService::derive_key("correct_password", &protection).unwrap();
        let wrong_key = EncryptionService::derive_key("wrong_password", &protection).unwrap();

        let ciphertext = EncryptionService::encrypt(b"secret data", &key, &protection).unwrap();
        let result = EncryptionService::decrypt(&ciphertext, &wrong_key, &protection);

        assert!(matches!(result, Err(StorageError::WrongPassword)));
    }

    #[test]
    fn test_different_calls_produce_different_nonce() {
        let p1 = EncryptionService::new_protection().unwrap();
        let p2 = EncryptionService::new_protection().unwrap();
        assert_ne!(p1.nonce, p2.nonce);
        assert_ne!(p1.salt, p2.salt);
    }

    #[test]
    fn test_derive_key_is_deterministic() {
        let protection = EncryptionService::new_protection().unwrap();
        let key1 = EncryptionService::derive_key("pass", &protection).unwrap();
        let key2 = EncryptionService::derive_key("pass", &protection).unwrap();
        assert_eq!(key1, key2);
    }
}
