# ADR-009: react-i18next para Internacionalização

## Status
Aceito

## Contexto
O Open Note precisa suportar múltiplos idiomas. O público inicial é brasileiro (pt-BR) com expansão para inglês (en). A solução deve permitir troca de idioma sem restart e ser extensível para novos idiomas.

## Alternativas Consideradas

| Opção | Prós | Contras |
|---|---|---|
| **react-i18next** | Maduro, React hooks nativos, pluralização, interpolação, lazy loading | Dependência adicional |
| **react-intl (FormatJS)** | ICU message format, bom para plurals complexos | API mais verbosa, setup mais complexo |
| **DIY (Context + JSON)** | Sem dependência, controle total | Reinventar a roda, sem pluralização/interpolação |
| **next-intl** | Otimizado para Next.js | Acoplado a Next.js, não aplicável |

## Decisão
Adotar **react-i18next** com `i18next` como engine.

## Implementação

### Configuração

```typescript
// src/lib/i18n.ts
i18n.use(initReactI18next).init({
  resources: { 'pt-BR': ptBR, en },
  lng: 'pt-BR',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

### Idiomas

| Idioma | Código | Status | Chaves |
|---|---|---|---|
| Português (Brasil) | `pt-BR` | Padrão | 250+ |
| English | `en` | Fallback | 250+ |

### Uso em componentes

```tsx
import { useTranslation } from 'react-i18next';

function MeuComponente() {
  const { t } = useTranslation();
  return <h1>{t('meuComponente.titulo')}</h1>;
}
```

### Regras

1. **Nenhuma string visível hardcoded** — tudo via `t('key')`
2. **Chaves organizadas por componente/feature** no JSON
3. **Erros do backend:** Rust retorna código de erro (ex: `NOTEBOOK_ALREADY_EXISTS`), frontend traduz
4. **Troca sem restart:** `i18n.changeLanguage('en')` re-renderiza tudo
5. **Persistência:** `GlobalSettings.language` em `app_state.json`

### Estrutura de locales

```
src/locales/
├── pt-BR.json    # 250+ chaves
└── en.json       # 250+ chaves
```

## Justificativa
- **react-i18next** é o padrão de facto para i18n em React
- Hook `useTranslation()` se integra naturalmente com componentes funcionais
- Fallback automático: se chave não existe em pt-BR, usa en
- Interpolação: `t('greeting', { name: 'João' })` → "Olá, João!"
- Extensível: adicionar novo idioma é criar um JSON e registrar

## Consequências

### Positivas
- Suporte multilíngue desde o início
- Troca de idioma instantânea
- Fácil de adicionar novos idiomas (apenas JSON)
- Separação clara entre código e texto

### Negativas
- Toda string visível precisa passar por `t()` (disciplina)
- Arquivos JSON grandes (250+ chaves cada)
- Manter paridade entre idiomas requer atenção

### Riscos
- Chaves faltando em um idioma (mitigado: fallback para en)
- Strings não traduzidas (mitigado: review de PR)
