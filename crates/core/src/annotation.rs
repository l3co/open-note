use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::id::{AnnotationId, BlockId, StrokeId};

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct PageAnnotations {
    pub strokes: Vec<AnchoredStroke>,
    pub highlights: Vec<HighlightAnnotation>,
    pub svg_cache: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct AnchoredStroke {
    pub id: StrokeId,
    pub points: Vec<StrokePoint>,
    pub color: String,
    pub size: f32,
    pub tool: InkTool,
    pub opacity: f32,
    pub timestamp: i64,
    pub anchor: Option<StrokeAnchor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct StrokeAnchor {
    pub block_id: BlockId,
    pub offset_x: f64,
    pub offset_y: f64,
    pub pdf_page: Option<u32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct StrokePoint {
    pub x: f64,
    pub y: f64,
    pub pressure: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
pub struct HighlightAnnotation {
    pub id: AnnotationId,
    pub block_id: BlockId,
    pub start_offset: u32,
    pub end_offset: u32,
    pub color: String,
    pub opacity: f32,
}

impl HighlightAnnotation {
    pub fn new(block_id: BlockId, start_offset: u32, end_offset: u32, color: &str) -> Self {
        Self {
            id: AnnotationId::new(),
            block_id,
            start_offset,
            end_offset,
            color: color.to_string(),
            opacity: 0.3,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/types/bindings/")]
#[serde(rename_all = "snake_case")]
pub enum InkTool {
    Pen,
    Marker,
    Eraser,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_annotations_are_empty() {
        let ann = PageAnnotations::default();
        assert!(ann.strokes.is_empty());
        assert!(ann.highlights.is_empty());
        assert!(ann.svg_cache.is_none());
    }

    #[test]
    fn highlight_default_opacity_is_03() {
        let hl = HighlightAnnotation::new(BlockId::new(), 0, 10, "#eab308");
        assert!((hl.opacity - 0.3).abs() < f32::EPSILON);
    }

    #[test]
    fn ink_tool_serializes_as_snake_case() {
        let json = serde_json::to_string(&InkTool::Pen).unwrap();
        assert_eq!(json, "\"pen\"");
    }
}
