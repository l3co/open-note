# ADR-001: Tauri v2 como Runtime Desktop

## Status

Aceito

## Contexto

Precisamos de um runtime para aplicação desktop que suporte:
- macOS, Windows e Linux
- Binário leve (< 10MB)
- Acesso ao filesystem local
- WebView para UI (React)
- Potencial futuro para mobile (Android/iOS)

Alternativas avaliadas:
- **Electron** — maduro, mas binário pesado (~150MB), alto consumo de RAM
- **Tauri v1** — leve, mas API limitada, sem suporte mobile
- **Tauri v2** — leve (~5MB), Rust nativo, suporte desktop + mobile, API moderna

## Decisão

Usar **Tauri v2** como runtime.

## Justificativa

- **Binário leve:** ~5MB vs ~150MB do Electron
- **Rust nativo:** lógica de negócio em Rust com tipagem forte e performance
- **Multi-platform:** desktop (macOS/Win/Linux) e mobile (Android/iOS) a partir do mesmo projeto
- **Segurança:** modelo de capabilities (permissões granulares por janela)
- **WebView nativo:** usa o WebView do OS (não bundla Chromium)
- **IPC tipado:** comunicação frontend ↔ backend com serialização automática via serde

## Riscos

- Tauri v2 ainda em evolução — possíveis breaking changes em minor versions
- Ecossistema de plugins menor que Electron
- WebView do OS pode ter inconsistências entre plataformas

## Mitigação

- Fixar versões no `Cargo.toml`
- Abstrair IPC com wrapper tipado (`src/lib/tauri.ts`)
- Testar em todos os OS alvo no CI
