use std::time::Duration;

use std::net::{SocketAddr, TcpListener as StdTcpListener};

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;

use crate::error::{SyncError, SyncResult};

pub const CALLBACK_PORT: u16 = 19876;
const AUTH_TIMEOUT_SECS: u64 = 120;

const SUCCESS_HTML: &[u8] = b"HTTP/1.1 200 OK\r\n\
    Content-Type: text/html; charset=utf-8\r\n\
    \r\n\
    <!DOCTYPE html><html><head><meta charset='utf-8'>\
    <title>Open Note</title></head>\
    <body style='font-family:sans-serif;text-align:center;padding:50px'>\
    <h2>&#10003; Autorizado com sucesso!</h2>\
    <p>Voc&#234; pode fechar esta aba e voltar ao Open Note.</p>\
    </body></html>";

const ERROR_HTML: &[u8] = b"HTTP/1.1 400 Bad Request\r\n\
    Content-Type: text/html; charset=utf-8\r\n\
    \r\n\
    <!DOCTYPE html><html>\
    <body style='font-family:sans-serif;text-align:center;padding:50px'>\
    <h2>Erro na autoriza&#231;&#227;o</h2>\
    <p>Feche esta aba e tente novamente.</p>\
    </body></html>";

/// Aguarda o callback OAuth2 em `http://localhost:19876/callback`.
/// Retorna o `code` recebido ou erro se o timeout expirar.
pub async fn wait_for_oauth_code() -> SyncResult<String> {
    tokio::time::timeout(Duration::from_secs(AUTH_TIMEOUT_SECS), listen_for_code())
        .await
        .map_err(|_| SyncError::AuthFailed {
            message: format!("OAuth timeout: usuário não autorizou dentro de {AUTH_TIMEOUT_SECS}s"),
        })?
}

async fn listen_for_code() -> SyncResult<String> {
    let addr: SocketAddr = format!("127.0.0.1:{CALLBACK_PORT}").parse().unwrap();
    let std_listener = StdTcpListener::bind(addr).map_err(|e| SyncError::AuthFailed {
        message: format!("Falha ao abrir porta de callback OAuth {CALLBACK_PORT}: {e}"),
    })?;
    std_listener
        .set_nonblocking(true)
        .map_err(|e| SyncError::Network(e.to_string()))?;
    let listener =
        TcpListener::from_std(std_listener).map_err(|e| SyncError::Network(e.to_string()))?;

    let (stream, _) = listener
        .accept()
        .await
        .map_err(|e| SyncError::Network(e.to_string()))?;

    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);

    let mut request_line = String::new();
    reader
        .read_line(&mut request_line)
        .await
        .map_err(|e| SyncError::Network(e.to_string()))?;

    let code_result = extract_code_from_request(&request_line);

    let response = if code_result.is_ok() {
        SUCCESS_HTML
    } else {
        ERROR_HTML
    };

    write_half
        .write_all(response)
        .await
        .map_err(|e| SyncError::Network(e.to_string()))?;

    code_result
}

fn extract_code_from_request(request_line: &str) -> SyncResult<String> {
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| SyncError::AuthFailed {
            message: "Requisição HTTP inválida no callback OAuth".to_string(),
        })?;

    let query = path
        .split('?')
        .nth(1)
        .ok_or_else(|| SyncError::AuthFailed {
            message: "Sem parâmetros de query no callback OAuth".to_string(),
        })?;

    for param in query.split('&') {
        let mut kv = param.splitn(2, '=');
        if kv.next() == Some("code") {
            return kv
                .next()
                .map(percent_decode)
                .ok_or_else(|| SyncError::AuthFailed {
                    message: "Parâmetro 'code' vazio no callback OAuth".to_string(),
                });
        }
    }

    Err(SyncError::AuthFailed {
        message: "Parâmetro 'code' não encontrado no callback OAuth".to_string(),
    })
}

fn percent_decode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut bytes = s.bytes().peekable();
    while let Some(b) = bytes.next() {
        if b == b'%' {
            let h1 = bytes.next().and_then(hex_val);
            let h2 = bytes.next().and_then(hex_val);
            match (h1, h2) {
                (Some(h1), Some(h2)) => out.push(char::from((h1 << 4) | h2)),
                _ => out.push('%'),
            }
        } else if b == b'+' {
            out.push(' ');
        } else {
            out.push(char::from(b));
        }
    }
    out
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_code_from_valid_request() {
        let line = "GET /callback?code=abc123&state=xyz HTTP/1.1";
        assert_eq!(extract_code_from_request(line).unwrap(), "abc123");
    }

    #[test]
    fn extract_code_percent_encoded() {
        let line = "GET /callback?code=abc%2B123 HTTP/1.1";
        assert_eq!(extract_code_from_request(line).unwrap(), "abc+123");
    }

    #[test]
    fn extract_code_no_query_returns_err() {
        let line = "GET /callback HTTP/1.1";
        assert!(extract_code_from_request(line).is_err());
    }

    #[test]
    fn extract_code_no_code_param_returns_err() {
        let line = "GET /callback?state=xyz HTTP/1.1";
        assert!(extract_code_from_request(line).is_err());
    }

    #[test]
    fn extract_code_empty_request_line_returns_err() {
        assert!(extract_code_from_request("").is_err());
    }

    #[test]
    fn extract_code_only_one_token_returns_err() {
        assert!(extract_code_from_request("GET").is_err());
    }

    #[test]
    fn extract_code_multiple_params_finds_code() {
        let line = "GET /callback?state=abc&code=mycode123&foo=bar HTTP/1.1";
        assert_eq!(extract_code_from_request(line).unwrap(), "mycode123");
    }

    #[test]
    fn percent_decode_plain_ascii() {
        assert_eq!(percent_decode("hello"), "hello");
    }

    #[test]
    fn percent_decode_plus_becomes_space() {
        assert_eq!(percent_decode("hello+world"), "hello world");
    }

    #[test]
    fn percent_decode_lowercase_hex() {
        assert_eq!(percent_decode("abc%2bdef"), "abc+def");
    }

    #[test]
    fn percent_decode_uppercase_hex() {
        assert_eq!(percent_decode("abc%2Bdef"), "abc+def");
    }

    #[test]
    fn percent_decode_invalid_hex_emits_percent_and_consumes_chars() {
        // Implementation consumes the two chars after % but only emits '%'
        assert_eq!(percent_decode("%GG"), "%");
    }

    #[test]
    fn percent_decode_incomplete_at_end_keeps_percent() {
        assert_eq!(percent_decode("abc%"), "abc%");
    }

    #[test]
    fn percent_decode_incomplete_one_char_emits_percent() {
        // Implementation consumes the partial char after % and emits only '%'
        assert_eq!(percent_decode("abc%2"), "abc%");
    }

    #[test]
    fn percent_decode_space_encoding() {
        assert_eq!(percent_decode("hello%20world"), "hello world");
    }

    #[test]
    fn percent_decode_empty_string() {
        assert_eq!(percent_decode(""), "");
    }
}
