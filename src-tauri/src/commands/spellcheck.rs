use opennote_core::spellcheck::{SpellCheckMatch, SpellCheckRequest, SpellCheckResponse};
use serde::Deserialize;

const LANGUAGE_TOOL_URL: &str = "https://api.languagetool.org/v2/check";

#[derive(Debug, Deserialize)]
struct LtResponse {
    matches: Vec<LtMatch>,
    language: LtLanguage,
}

#[derive(Debug, Deserialize)]
struct LtMatch {
    message: String,
    offset: usize,
    length: usize,
    replacements: Vec<LtReplacement>,
    rule: LtRule,
}

#[derive(Debug, Deserialize)]
struct LtReplacement {
    value: String,
}

#[derive(Debug, Deserialize)]
struct LtRule {
    id: String,
    description: String,
    category: LtCategory,
}

#[derive(Debug, Deserialize)]
struct LtCategory {
    id: String,
}

#[derive(Debug, Deserialize)]
struct LtLanguage {
    code: String,
}

fn map_lt_response(lt: LtResponse) -> SpellCheckResponse {
    let matches = lt
        .matches
        .into_iter()
        .map(|m| SpellCheckMatch {
            message: m.message,
            offset: m.offset,
            length: m.length,
            replacements: m
                .replacements
                .into_iter()
                .take(5)
                .map(|r| r.value)
                .collect(),
            rule_id: m.rule.id,
            rule_description: m.rule.description,
            category: m.rule.category.id,
        })
        .collect();

    SpellCheckResponse {
        matches,
        language: lt.language.code,
    }
}

#[tauri::command]
pub async fn check_spelling(request: SpellCheckRequest) -> Result<SpellCheckResponse, String> {
    request.validate()?;

    let client = reqwest::Client::new();
    let response = client
        .post(LANGUAGE_TOOL_URL)
        .form(&[
            ("text", request.text.as_str()),
            ("language", request.language.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("LanguageTool request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "LanguageTool returned status {}",
            response.status()
        ));
    }

    let lt_response: LtResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LanguageTool response: {e}"))?;

    Ok(map_lt_response(lt_response))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_lt_response_converts_correctly() {
        let lt = LtResponse {
            matches: vec![LtMatch {
                message: "Possible typo".to_string(),
                offset: 0,
                length: 4,
                replacements: vec![
                    LtReplacement {
                        value: "Test".to_string(),
                    },
                    LtReplacement {
                        value: "Fest".to_string(),
                    },
                ],
                rule: LtRule {
                    id: "MORFOLOGIK_RULE".to_string(),
                    description: "Spelling mistake".to_string(),
                    category: LtCategory {
                        id: "TYPOS".to_string(),
                    },
                },
            }],
            language: LtLanguage {
                code: "en-US".to_string(),
            },
        };

        let result = map_lt_response(lt);
        assert_eq!(result.matches.len(), 1);
        assert_eq!(result.matches[0].message, "Possible typo");
        assert_eq!(result.matches[0].offset, 0);
        assert_eq!(result.matches[0].length, 4);
        assert_eq!(result.matches[0].replacements, vec!["Test", "Fest"]);
        assert_eq!(result.matches[0].rule_id, "MORFOLOGIK_RULE");
        assert_eq!(result.matches[0].category, "TYPOS");
        assert_eq!(result.language, "en-US");
    }

    #[test]
    fn map_lt_response_limits_replacements_to_5() {
        let lt = LtResponse {
            matches: vec![LtMatch {
                message: "Test".to_string(),
                offset: 0,
                length: 1,
                replacements: (0..10)
                    .map(|i| LtReplacement {
                        value: format!("r{i}"),
                    })
                    .collect(),
                rule: LtRule {
                    id: "R1".to_string(),
                    description: "D1".to_string(),
                    category: LtCategory {
                        id: "C1".to_string(),
                    },
                },
            }],
            language: LtLanguage {
                code: "en".to_string(),
            },
        };

        let result = map_lt_response(lt);
        assert_eq!(result.matches[0].replacements.len(), 5);
    }

    #[test]
    fn map_lt_response_handles_empty_matches() {
        let lt = LtResponse {
            matches: vec![],
            language: LtLanguage {
                code: "pt-BR".to_string(),
            },
        };

        let result = map_lt_response(lt);
        assert!(result.matches.is_empty());
        assert_eq!(result.language, "pt-BR");
    }
}
