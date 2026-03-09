# ADR-007: Estratégia Local-First Cloud-Aware

## Status
Aceito

## Contexto
O Open Note precisa definir a relação entre dados locais e sincronização na nuvem. A decisão impacta UX, arquitetura de dados, fluxo de startup e modelo de consistência.

## Alternativas Consideradas

| Opção | Descrição |
|---|---|
| **Cloud-first** | Dados primários na nuvem, cache local. Requer conexão. |
| **Local-only** | Sem nenhuma opção de sync. Dados apenas no filesystem. |
| **Local-first, cloud-aware** | Dados locais são a fonte de verdade. Sync é opt-in. UI mostra opções de cloud desde o início. |

## Decisão
Adotar **Local-First, Cloud-Aware**.

## Princípios

1. **Workspace sempre começa local.** Funciona 100% offline.
2. **Cloud é opt-in.** Botão "Conectar na nuvem" visível desde o WorkspacePicker (badge "Em breve" até implementação).
3. **Migração local → cloud a qualquer momento** via Settings → Sincronização.
4. **Desconectar nunca deleta dados.** Ambas as cópias (local e remota) permanecem intactas.
5. **Sem conta obrigatória.** App funciona completamente sem login.

## Fluxo de Sync

```
1. Usuário abre Settings → Sync
2. Escolhe provider (Google Drive / OneDrive / Dropbox)
3. OAuth2 → autorização
4. Upload inicial dos arquivos locais
5. Sync bidirecional ativado (intervalo configurável, default 5min)
6. Conflitos detectados → UI de resolução (KeepLocal / KeepRemote / KeepBoth)
```

## Indicadores Visuais

| Ícone | Estado |
|---|---|
| 📂 | Workspace local (sem sync) |
| ☁️ | Sync ativo e saudável |
| ☁️⚠ | Sync com erro ou conflitos pendentes |

## Justificativa
- **Privacidade:** Dados do usuário nunca saem do dispositivo sem consentimento explícito
- **Confiabilidade:** App funciona mesmo sem internet
- **Simplicidade:** Modelo mental claro — filesystem local é a fonte de verdade
- **Sem vendor lock-in:** Sync é com provedores genéricos (GDrive/OneDrive/Dropbox), não com servidor proprietário
- **Progressividade:** Usuário começa simples (local) e adiciona complexidade (sync) quando quiser

## Consequências

### Positivas
- Zero dependência de servidores para funcionamento básico
- Dados sempre acessíveis offline
- Migração fácil entre máquinas (copiar pasta)
- Sem custos de infraestrutura para o projeto

### Negativas
- Sync file-level (não block-level) pode gerar conflitos com edição simultânea
- Sem colaboração real-time (fora do escopo v1)
- Usuário responsável por backups se não usar sync

### Riscos
- Conflitos frequentes se mesmo workspace editado em 2 máquinas (mitigado: detecção de conflitos + UI de resolução)
- Perda de dados se disco falhar sem sync (mitigado: documentação clara sobre importância de backups)
