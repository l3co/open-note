use std::collections::HashSet;

use unicode_normalization::UnicodeNormalization;

const MAX_SLUG_LENGTH: usize = 64;

pub fn slugify(input: &str) -> String {
    let normalized: String = input
        .nfd()
        .filter(|c| !c.is_ascii() || !is_combining(*c))
        .collect();

    let slug: String = normalized
        .nfd()
        .filter(|c| !is_combining(*c))
        .collect::<String>()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();

    let slug = collapse_dashes(&slug);
    let slug = slug.trim_matches('-');

    if slug.len() > MAX_SLUG_LENGTH {
        let truncated = &slug[..MAX_SLUG_LENGTH];
        truncated.trim_end_matches('-').to_string()
    } else {
        slug.to_string()
    }
}

pub fn unique_slug(base: &str, existing: &HashSet<String>) -> String {
    let slug = slugify(base);
    if slug.is_empty() {
        return unique_slug("untitled", existing);
    }
    if !existing.contains(&slug) {
        return slug;
    }
    for i in 2..=999 {
        let candidate = format!("{slug}-{i}");
        if !existing.contains(&candidate) {
            return candidate;
        }
    }
    format!("{slug}-{}", uuid::Uuid::new_v4())
}

fn is_combining(c: char) -> bool {
    matches!(c as u32, 0x0300..=0x036F | 0x1AB0..=0x1AFF | 0x1DC0..=0x1DFF | 0xFE20..=0xFE2F)
}

fn collapse_dashes(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut prev_dash = false;
    for c in s.chars() {
        if c == '-' {
            if !prev_dash {
                result.push('-');
            }
            prev_dash = true;
        } else {
            result.push(c);
            prev_dash = false;
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_slug() {
        assert_eq!(slugify("Hello World"), "hello-world");
    }

    #[test]
    fn removes_accents() {
        assert_eq!(slugify("Aula 01 — Introdução"), "aula-01-introducao");
    }

    #[test]
    fn removes_special_characters() {
        assert_eq!(slugify("Meu Notebook #1"), "meu-notebook-1");
    }

    #[test]
    fn collapses_dashes() {
        assert_eq!(slugify("a - - b"), "a-b");
    }

    #[test]
    fn trims_dashes() {
        assert_eq!(slugify("--hello--"), "hello");
    }

    #[test]
    fn truncates_to_64_chars() {
        let long_name = "a".repeat(100);
        let slug = slugify(&long_name);
        assert!(slug.len() <= MAX_SLUG_LENGTH);
    }

    #[test]
    fn unique_slug_no_conflict() {
        let existing = HashSet::new();
        assert_eq!(unique_slug("Test", &existing), "test");
    }

    #[test]
    fn unique_slug_with_conflict() {
        let mut existing = HashSet::new();
        existing.insert("test".to_string());
        assert_eq!(unique_slug("Test", &existing), "test-2");
    }

    #[test]
    fn unique_slug_multiple_conflicts() {
        let mut existing = HashSet::new();
        existing.insert("test".to_string());
        existing.insert("test-2".to_string());
        existing.insert("test-3".to_string());
        assert_eq!(unique_slug("Test", &existing), "test-4");
    }

    #[test]
    fn empty_input_becomes_untitled() {
        let existing = HashSet::new();
        assert_eq!(unique_slug("", &existing), "untitled");
    }
}
