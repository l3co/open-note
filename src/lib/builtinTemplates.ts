import type { Block } from "@/types/bindings/Block";
import type { EditorPreferences } from "@/types/bindings/EditorPreferences";
import type { TemplateCategory } from "@/types/bindings/TemplateCategory";

export interface BuiltinTemplate {
  id: string; // formato: "builtin-<slug>"
  name: string; // chave i18n: templates.builtin.<slug>.name
  descriptionKey: string; // chave i18n
  category: TemplateCategory;
  icon: string; // emoji
  titleTemplate: string;
  tags: string[];
  blocks: Block[];
  editorPreferences: EditorPreferences;
  isBuiltin: true;
}

const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  mode: "rich_text",
  split_view: false,
};

/**
 * Gera base de bloco com UUID válido.
 * crypto.randomUUID() é necessário — o backend Rust deserializa `id` como uuid::Uuid.
 */
function createBase(order: number) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    order,
    created_at: now,
    updated_at: now,
  };
}

/** Nó ProseMirror: heading */
const h = (level: 1 | 2 | 3, text: string) => ({
  type: "heading",
  attrs: { level },
  content: [{ type: "text", text }],
});

/** Nó ProseMirror: paragraph vazio ou com texto */
const p = (text?: string) =>
  text
    ? { type: "paragraph", content: [{ type: "text", text }] }
    : { type: "paragraph" };

/** Bloco text com doc ProseMirror */
const textBlock = (order: number, ...nodes: object[]): Block =>
  ({
    type: "text",
    ...createBase(order),
    content: { type: "doc", content: nodes },
  }) as Block;

/** Bloco checklist */
const checklistBlock = (order: number, count = 3): Block =>
  ({
    type: "checklist",
    ...createBase(order),
    items: Array.from({ length: count }, () => ({ text: "", checked: false })),
  }) as Block;

/** Bloco divider */
const dividerBlock = (order: number): Block =>
  ({ type: "divider", ...createBase(order) }) as Block;

/** Bloco callout */
const calloutBlock = (
  order: number,
  variant: "info" | "tip" | "warning" | "success" | "error",
  content: string,
): Block =>
  ({ type: "callout", ...createBase(order), variant, content }) as Block;

/** Bloco table */
const tableBlock = (
  order: number,
  rows: string[][],
  has_header = true,
): Block =>
  ({ type: "table", ...createBase(order), rows, has_header }) as Block;

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  // ─── Página em Branco ───────────────────────────────────────────────────────
  {
    id: "builtin-blank",
    name: "templates.builtin.blank.name",
    descriptionKey: "templates.builtin.blank.description",
    category: "custom",
    icon: "📄",
    titleTemplate: "{{date}}",
    tags: [],
    blocks: [],
    editorPreferences: DEFAULT_EDITOR_PREFERENCES,
    isBuiltin: true,
  },

  // ─── Reunião ────────────────────────────────────────────────────────────────
  // Baseado em GTD + melhores práticas de facilitação de reuniões eficazes
  {
    id: "builtin-meeting",
    name: "templates.builtin.meeting.name",
    descriptionKey: "templates.builtin.meeting.description",
    category: "meeting",
    icon: "📅",
    titleTemplate: "Reunião — {{date}}",
    tags: ["reunião"],
    blocks: [
      calloutBlock(
        0,
        "info",
        "Objetivo desta reunião: descreva o propósito e o resultado esperado.",
      ),
      textBlock(1, h(2, "Participantes"), p()),
      textBlock(2, h(2, "Pauta"), p(), p(), p()),
      textBlock(3, h(2, "Anotações"), p()),
      textBlock(4, h(2, "Decisões Tomadas"), p()),
      textBlock(5, h(2, "Action Items")),
      checklistBlock(6, 3),
      textBlock(7, h(3, "Próxima Reunião"), p()),
    ],
    editorPreferences: DEFAULT_EDITOR_PREFERENCES,
    isBuiltin: true,
  },

  // ─── Diário ─────────────────────────────────────────────────────────────────
  // Baseado no 5-Minute Journal + Bullet Journal + reflexão noturna estruturada
  {
    id: "builtin-daily-journal",
    name: "templates.builtin.daily_journal.name",
    descriptionKey: "templates.builtin.daily_journal.description",
    category: "journal",
    icon: "📓",
    titleTemplate: "Diário — {{date}}",
    tags: ["diário"],
    blocks: [
      textBlock(0, h(3, "Como estou chegando no dia de hoje?"), p()),
      textBlock(1, h(3, "3 Coisas pelas quais sou grato")),
      checklistBlock(2, 3),
      calloutBlock(
        3,
        "tip",
        "Intenção do dia: o que tornaria este dia realmente especial?",
      ),
      textBlock(4, h(3, "Top 3 Prioridades")),
      checklistBlock(5, 3),
      dividerBlock(6),
      textBlock(
        7,
        h(3, "Reflexão Noturna"),
        p("O que foi bem:"),
        p(),
        p("O que poderia ter sido melhor:"),
        p(),
        p("O que aprendi hoje:"),
        p(),
      ),
    ],
    editorPreferences: DEFAULT_EDITOR_PREFERENCES,
    isBuiltin: true,
  },

  // ─── Projeto ─────────────────────────────────────────────────────────────────
  // Baseado em Project Charter + OKRs + gestão de riscos
  {
    id: "builtin-project",
    name: "templates.builtin.project.name",
    descriptionKey: "templates.builtin.project.description",
    category: "project",
    icon: "🗂️",
    titleTemplate: "Projeto — {{date}}",
    tags: ["projeto"],
    blocks: [
      calloutBlock(
        0,
        "info",
        "Descreva o projeto em uma frase: qual problema resolve e para quem.",
      ),
      textBlock(
        1,
        h(2, "Objetivo"),
        p(
          "Defina o objetivo principal (SMART: específico, mensurável, atingível, relevante, temporal).",
        ),
      ),
      textBlock(2, h(2, "Critérios de Sucesso"), p()),
      textBlock(3, h(2, "Escopo")),
      tableBlock(4, [
        ["Item", "Dentro do Escopo", "Fora do Escopo"],
        ["", "", ""],
        ["", "", ""],
      ]),
      textBlock(5, h(2, "Stakeholders")),
      tableBlock(6, [
        ["Nome", "Papel", "Contato"],
        ["", "", ""],
        ["", "", ""],
      ]),
      textBlock(7, h(2, "Cronograma")),
      tableBlock(8, [
        ["Fase", "Início", "Término", "Entregável"],
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
      ]),
      calloutBlock(
        9,
        "warning",
        "Riscos identificados: liste os principais riscos e as mitigações planejadas.",
      ),
    ],
    editorPreferences: DEFAULT_EDITOR_PREFERENCES,
    isBuiltin: true,
  },

  // ─── Estudo ──────────────────────────────────────────────────────────────────
  // Baseado em Cornell Notes + Técnica Feynman + Repetição Espaçada
  {
    id: "builtin-study",
    name: "templates.builtin.study.name",
    descriptionKey: "templates.builtin.study.description",
    category: "study",
    icon: "🎓",
    titleTemplate: "Estudo — {{date}}",
    tags: ["estudo"],
    blocks: [
      textBlock(
        0,
        h(2, "Tema"),
        p(),
        h(3, "Fonte"),
        p("Livro / curso / artigo / vídeo"),
      ),
      calloutBlock(
        1,
        "info",
        "Perguntas-chave: o que quero aprender ou responder com este material?",
      ),
      textBlock(2, h(2, "Notas e Conceitos Principais"), p()),
      textBlock(3, h(2, "Exemplos"), p()),
      dividerBlock(4),
      textBlock(
        5,
        h(2, "Meu Resumo (Técnica Feynman)"),
        p(
          "Explique o conceito com suas próprias palavras, como se ensinasse para alguém sem conhecimento prévio.",
        ),
      ),
      textBlock(6, h(3, "Revisão Espaçada")),
      {
        type: "checklist",
        ...createBase(7),
        items: [
          { text: "Revisar em 24 horas", checked: false },
          { text: "Revisar em 1 semana", checked: false },
          { text: "Revisar em 1 mês", checked: false },
        ],
      } as Block,
      calloutBlock(
        8,
        "tip",
        "A repetição espaçada melhora a retenção em até 80%. Não pule as revisões programadas.",
      ),
    ],
    editorPreferences: DEFAULT_EDITOR_PREFERENCES,
    isBuiltin: true,
  },
];

/**
 * Resolve placeholders em titleTemplate:
 *   {{date}} → data atual em YYYY-MM-DD
 */
export function resolveTemplateTitle(titleTemplate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return titleTemplate.replace(/\{\{date\}\}/g, today);
}
