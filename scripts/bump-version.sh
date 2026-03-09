#!/bin/bash
#
# Script de bump de versão para Open Note
# Sincroniza versões entre Cargo.toml, package.json e tauri.conf.json
#

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arquivos que contêm versão
CARGO_TOML="src-tauri/Cargo.toml"
PACKAGE_JSON="package.json"
TAURI_CONF="src-tauri/tauri.conf.json"

# Funções de ajuda
show_help() {
    echo -e "${BLUE}Open Note Version Bumper${NC}"
    echo ""
    echo "Uso: $0 [patch|minor|major|x.y.z]"
    echo ""
    echo "Argumentos:"
    echo "  patch       Incrementa a versão de patch (0.1.0 -> 0.1.1)"
    echo "  minor       Incrementa a versão minor (0.1.0 -> 0.2.0)"
    echo "  major       Incrementa a versão major (0.1.0 -> 1.0.0)"
    echo "  x.y.z       Define uma versão específica (ex: 1.2.3)"
    echo ""
    echo "Opções:"
    echo "  -h, --help  Mostra esta ajuda"
    echo "  --dry-run   Simula as alterações sem aplicá-las"
    echo ""
    echo "Exemplos:"
    echo "  $0 patch           # 0.1.0 -> 0.1.1"
    echo "  $0 minor           # 0.1.0 -> 0.2.0"
    echo "  $0 1.2.0           # Define versão específica"
    echo "  $0 patch --dry-run # Apenas mostra o que seria feito"
}

# Extrai versão atual do Cargo.toml
get_current_version() {
    grep '^version = ' "$CARGO_TOML" | head -1 | sed 's/version = "\(.*\)"/\1/'
}

# Valida formato de versão semântica
validate_version() {
    if [[ ! $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
        echo -e "${RED}Erro: Versão inválida: $1${NC}"
        echo "Formato esperado: MAJOR.MINOR.PATCH[-prerelease][+build]"
        exit 1
    fi
}

# Calcula nova versão baseada no tipo de bump
calculate_new_version() {
    local current=$1
    local bump_type=$2

    # Extrai componentes
    local major=$(echo "$current" | cut -d. -f1)
    local minor=$(echo "$current" | cut -d. -f2)
    local patch=$(echo "$current" | cut -d. -f3 | cut -d- -f1 | cut -d+ -f1)

    case $bump_type in
        major)
            echo "$((major + 1)).0.0"
            ;;
        minor)
            echo "${major}.$((minor + 1)).0"
            ;;
        patch)
            echo "${major}.${minor}.$((patch + 1))"
            ;;
        *)
            echo "$bump_type"
            ;;
    esac
}

# Atualiza versão em um arquivo
update_version_in_file() {
    local file=$1
    local old_version=$2
    local new_version=$3
    local dry_run=$4

    if [ "$dry_run" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Atualizaria $file: $old_version -> $new_version"
        return
    fi

    case "$file" in
        *Cargo.toml)
            sed -i.bak "s/^version = \"$old_version\"/version = \"$new_version\"/" "$file"
            rm -f "${file}.bak"
            ;;
        *package.json)
            sed -i.bak "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/" "$file"
            rm -f "${file}.bak"
            ;;
        *tauri.conf.json)
            sed -i.bak "s/\"version\": \"$old_version\"/\"version\": \"$new_version\"/" "$file"
            rm -f "${file}.bak"
            ;;
    esac

    echo -e "${GREEN}✓${NC} Atualizado $file: $old_version -> $new_version"
}

# Atualiza CHANGELOG.md
update_changelog() {
    local new_version=$1
    local dry_run=$2
    local date=$(date +%Y-%m-%d)

    if [ ! -f "CHANGELOG.md" ]; then
        echo -e "${YELLOW}⚠ CHANGELOG.md não encontrado, criando...${NC}"
        if [ "$dry_run" = false ]; then
            echo "# Changelog" > CHANGELOG.md
            echo "" >> CHANGELOG.md
        fi
    fi

    if [ "$dry_run" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Adicionaria entrada ao CHANGELOG.md para v$new_version"
        return
    fi

    # Cria nova entrada no changelog
    local temp_file=$(mktemp)
    echo "# Changelog" > "$temp_file"
    echo "" >> "$temp_file"
    echo "## [$new_version] - $date" >> "$temp_file"
    echo "" >> "$temp_file"
    echo "### Added" >> "$temp_file"
    echo "- " >> "$temp_file"
    echo "" >> "$temp_file"

    # Adiciona conteúdo antigo (se existir)
    if [ -f "CHANGELOG.md" ]; then
        tail -n +3 CHANGELOG.md >> "$temp_file" 2>/dev/null || true
    fi

    mv "$temp_file" CHANGELOG.md
    echo -e "${GREEN}✓${NC} Atualizado CHANGELOG.md"
}

# Cria commit e tag
create_commit_and_tag() {
    local new_version=$1
    local dry_run=$2
    local tag="v$new_version"

    if [ "$dry_run" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Criaria commit: 'chore(release): prepare $tag'"
        echo -e "${YELLOW}[DRY-RUN]${NC} Criaria tag: $tag"
        return
    fi

    # Verifica se há alterações para commitar
    if git diff --quiet HEAD; then
        echo -e "${YELLOW}⚠ Nenhuma alteração para commitar${NC}"
        return 1
    fi

    # Adiciona arquivos modificados
    git add "$CARGO_TOML" "$PACKAGE_JSON" "$TAURI_CONF" CHANGELOG.md 2>/dev/null || true

    # Cria commit
    git commit -m "chore(release): prepare $tag

Bump version to $new_version"

    echo -e "${GREEN}✓${NC} Commit criado: 'chore(release): prepare $tag'"

    # Cria tag
    git tag -a "$tag" -m "Release $tag"
    echo -e "${GREEN}✓${NC} Tag criada: $tag"

    echo ""
    echo -e "${BLUE}Próximos passos:${NC}"
    echo "  1. Review as alterações: git log --oneline -3"
    echo "  2. Push para o repositório:"
    echo -e "     ${YELLOW}git push origin main && git push origin $tag${NC}"
    echo ""
    echo "  Ou automaticamente:"
    echo -e "     ${YELLOW}git push origin main --follow-tags${NC}"
}

# ============ MAIN ============

# Parse argumentos
DRY_RUN=false
BUMP_TYPE=""

for arg in "$@"; do
    case $arg in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        patch|minor|major)
            BUMP_TYPE=$arg
            ;;
        *)
            if [[ $arg =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
                BUMP_TYPE=$arg
            elif [ -z "$BUMP_TYPE" ]; then
                echo -e "${RED}Erro: Tipo de bump desconhecido: $arg${NC}"
                show_help
                exit 1
            fi
            ;;
    esac
done

if [ -z "$BUMP_TYPE" ]; then
    echo -e "${RED}Erro: Tipo de bump não especificado${NC}"
    show_help
    exit 1
fi

# Obtém versão atual
CURRENT_VERSION=$(get_current_version)
if [ -z "$CURRENT_VERSION" ]; then
    echo -e "${RED}Erro: Não foi possível determinar a versão atual${NC}"
    exit 1
fi

echo -e "${BLUE}Open Note Version Bumper${NC}"
echo "=========================="
echo ""
echo -e "Versão atual: ${YELLOW}$CURRENT_VERSION${NC}"

# Calcula nova versão
NEW_VERSION=$(calculate_new_version "$CURRENT_VERSION" "$BUMP_TYPE")
validate_version "$NEW_VERSION"

echo -e "Nova versão:  ${GREEN}$NEW_VERSION${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}MODO DRY-RUN: Nenhuma alteração será aplicada${NC}"
    echo ""
fi

# Verifica se estamos em um repo git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Erro: Não é um repositório git${NC}"
    exit 1
fi

# Verifica se há arquivos não commitados (exceto em dry-run)
if [ "$DRY_RUN" = false ] && ! git diff --quiet HEAD; then
    echo -e "${YELLOW}⚠ Atenção: Há alterações não commitadas no repositório${NC}"
    echo "   Arquivos modificados:"
    git diff --name-only HEAD | sed 's/^/     - /'
    echo ""
    read -p "Deseja continuar mesmo assim? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operação cancelada."
        exit 0
    fi
fi

# Atualiza arquivos
echo "Atualizando arquivos..."
echo ""

update_version_in_file "$CARGO_TOML" "$CURRENT_VERSION" "$NEW_VERSION" "$DRY_RUN"
update_version_in_file "$PACKAGE_JSON" "$CURRENT_VERSION" "$NEW_VERSION" "$DRY_RUN"
update_version_in_file "$TAURI_CONF" "$CURRENT_VERSION" "$NEW_VERSION" "$DRY_RUN"
update_changelog "$NEW_VERSION" "$DRY_RUN"

echo ""

# Cria commit e tag
create_commit_and_tag "$NEW_VERSION" "$DRY_RUN"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${GREEN}Dry-run concluído. Execute sem --dry-run para aplicar as alterações.${NC}"
fi
