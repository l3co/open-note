# Configuração OAuth2 — Fase 09

As credenciais OAuth2 são embarcadas no binário em **build-time** via `option_env!()`.
Nunca as adicione ao código-fonte diretamente.

## Como configurar (desenvolvimento)

Crie um arquivo `.env.local` na raiz do projeto **(nunca commitar)**:

```bash
# Google Drive (Desktop app — console.cloud.google.com)
export GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxx"

# Dropbox (App key / App secret — dropbox.com/developers/apps)
export DROPBOX_CLIENT_ID="xxxxxxxxxxxxxxx"
export DROPBOX_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxx"

# OneDrive (apenas client_id, sem secret — portal.azure.com)
export ONEDRIVE_CLIENT_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Antes de buildar, execute:

```bash
source .env.local
cargo tauri dev
```

Ou no `package.json`, modifique o script `tauri:dev`:

```json
"tauri:dev": "source .env.local && tauri dev"
```

## Redirect URI registrada

Todos os providers usam: `http://localhost:19876/callback`

| Provider | Precisa registrar explicitamente? |
|---|---|
| Google Drive (Desktop app) | Não — `localhost` é implicitamente permitido |
| Dropbox | **Sim** — adicionar na aba Settings do app |
| OneDrive | Sim — configurado automaticamente como Public client |

## Variáveis por provider

| Variável | Provider | Tipo |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Drive | client_id |
| `GOOGLE_CLIENT_SECRET` | Google Drive | client_secret |
| `DROPBOX_CLIENT_ID` | Dropbox | App key |
| `DROPBOX_CLIENT_SECRET` | Dropbox | App secret |
| `ONEDRIVE_CLIENT_ID` | OneDrive | Application (client) ID |

## Build de produção

Para releases, injete via CI/CD (GitHub Actions secrets):

```yaml
- name: Build
  run: cargo tauri build
  env:
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
    DROPBOX_CLIENT_ID: ${{ secrets.DROPBOX_CLIENT_ID }}
    DROPBOX_CLIENT_SECRET: ${{ secrets.DROPBOX_CLIENT_SECRET }}
    ONEDRIVE_CLIENT_ID: ${{ secrets.ONEDRIVE_CLIENT_ID }}
```
