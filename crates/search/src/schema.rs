use tantivy::schema::{
    Field, IndexRecordOption, Schema, SchemaBuilder, TextFieldIndexing, TextOptions, STORED, STRING,
};

pub struct SearchSchema {
    pub schema: Schema,
    pub page_id: Field,
    pub title: Field,
    pub content: Field,
    pub tags: Field,
    pub notebook_name: Field,
    pub section_name: Field,
    pub notebook_id: Field,
    pub section_id: Field,
    pub updated_at: Field,
    pub created_at: Field,
}

impl SearchSchema {
    pub fn build() -> Self {
        let mut builder = SchemaBuilder::new();

        let page_id = builder.add_text_field("page_id", STRING | STORED);

        let title_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("opennote")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();
        let title = builder.add_text_field("title", title_options);

        let content_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("opennote")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();
        let content = builder.add_text_field("content", content_options);

        let tags_options = TextOptions::default()
            .set_indexing_options(
                TextFieldIndexing::default()
                    .set_tokenizer("opennote")
                    .set_index_option(IndexRecordOption::WithFreqsAndPositions),
            )
            .set_stored();
        let tags = builder.add_text_field("tags", tags_options);

        let notebook_name = builder.add_text_field("notebook_name", STRING | STORED);
        let section_name = builder.add_text_field("section_name", STRING | STORED);
        let notebook_id = builder.add_text_field("notebook_id", STRING | STORED);
        let section_id = builder.add_text_field("section_id", STRING | STORED);
        let updated_at = builder.add_text_field("updated_at", STRING | STORED);
        let created_at = builder.add_text_field("created_at", STRING | STORED);

        let schema = builder.build();

        Self {
            schema,
            page_id,
            title,
            content,
            tags,
            notebook_name,
            section_name,
            notebook_id,
            section_id,
            updated_at,
            created_at,
        }
    }
}
