WORKSPACE_DIR    := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
REPOS_JSON       := $(WORKSPACE_DIR)/repos.json
CONTRACT_SOURCES := $(WORKSPACE_DIR)/.contract-sources

# Dynamically discover cloned repo directories.
# Uses repos.json as the source of truth — only directories that exist AND are
# listed in repos.json are included. This avoids hardcoding repo names.
# Guard: skip if repos.json doesn't exist yet or jq is missing.
#
# If TAGS is set (comma-separated), filter to repos where .tags contains any match.
# Example: make update TAGS=orders
#          make status TAGS=orders,shared
ifeq ($(strip $(TAGS)),)
REPO_NAMES := $(if $(wildcard $(REPOS_JSON)),$(shell command -v jq >/dev/null 2>&1 && jq -r '.[].[] | .name' $(REPOS_JSON) 2>/dev/null))
else
REPO_NAMES := $(if $(wildcard $(REPOS_JSON)),$(shell command -v jq >/dev/null 2>&1 && jq -r --arg T "$(TAGS)" '($$T | split(",")) as $$w | .[].[] | select((.tags // []) | any(. as $$t | $$w | index($$t))) | .name' $(REPOS_JSON) 2>/dev/null))
endif

REPO_DIRS  := $(foreach name,$(REPO_NAMES),$(wildcard $(WORKSPACE_DIR)/$(name)/))

.PHONY: setup setup-full update status search help gitignore contracts-check

## Clone all repos (default). Use 'make setup-full' to also bootstrap deps.
## Supports TAGS=foo,bar to filter which repos are cloned.
setup:
	@TAGS="$(TAGS)" bash $(WORKSPACE_DIR)/setup.sh --clone-only $(ARGS)

## Full bootstrap — clone repos, install deps. Supports TAGS=foo,bar.
setup-full:
	@TAGS="$(TAGS)" bash $(WORKSPACE_DIR)/setup.sh $(ARGS)

## Pull latest on default branch across all cloned repos
update:
	@for dir in $(REPO_DIRS); do \
		name=$$(basename "$$dir"); \
		echo "\033[0;34m[workspace]\033[0m Updating $$name..."; \
		(cd "$$dir" && git pull --ff-only && echo "\033[0;32m[workspace]\033[0m $$name updated") \
		|| echo "\033[1;33m[workspace]\033[0m $$name — pull failed (check output above)"; \
	done

## Show git status for all cloned repos
status:
	@for dir in $(REPO_DIRS); do \
		name=$$(basename "$$dir"); \
		echo ""; \
		echo "=== $$name ==="; \
		(cd "$$dir" && git status --short --branch); \
	done

## Search across all cloned repos (usage: make search QUERY='...')
search:
ifndef QUERY
	@echo "Usage: make search QUERY='pattern'"
	@echo "  Searches file contents across all workspace repos."
else
	@if command -v rg >/dev/null 2>&1; then \
		rg --heading --line-number -- '$(subst ','"'"',$(QUERY))' $(REPO_DIRS) 2>/dev/null || echo "No results found."; \
	else \
		grep -rn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.pnpm-store --exclude-dir=vendor -- '$(subst ','"'"',$(QUERY))' $(REPO_DIRS) 2>/dev/null || echo "No results found."; \
	fi
endif

## Regenerate .gitignore from repos.json (run after adding repos)
gitignore:
	@if [ ! -f "$(REPOS_JSON)" ]; then echo "repos.json not found" >&2; exit 1; fi
	@echo "# Cloned repos (auto-generated from repos.json — run 'make gitignore' to update)" > $(WORKSPACE_DIR)/.gitignore
	@jq -r '.[].[] | .name + "/"' $(REPOS_JSON) >> $(WORKSPACE_DIR)/.gitignore
	@echo "" >> $(WORKSPACE_DIR)/.gitignore
	@echo "# OS" >> $(WORKSPACE_DIR)/.gitignore
	@echo ".DS_Store" >> $(WORKSPACE_DIR)/.gitignore
	@echo "" >> $(WORKSPACE_DIR)/.gitignore
	@echo "# Dependencies and secrets" >> $(WORKSPACE_DIR)/.gitignore
	@echo "node_modules/" >> $(WORKSPACE_DIR)/.gitignore
	@echo ".env*" >> $(WORKSPACE_DIR)/.gitignore
	@echo "" >> $(WORKSPACE_DIR)/.gitignore
	@echo "# Claude Code — ignore local files, track shared config, skills, and agents" >> $(WORKSPACE_DIR)/.gitignore
	@echo ".claude/*" >> $(WORKSPACE_DIR)/.gitignore
	@echo "!.claude/CLAUDE.md" >> $(WORKSPACE_DIR)/.gitignore
	@echo "!.claude/skills/" >> $(WORKSPACE_DIR)/.gitignore
	@echo "!.claude/agents/" >> $(WORKSPACE_DIR)/.gitignore
	@echo "!.claude/rules/" >> $(WORKSPACE_DIR)/.gitignore
	@echo "CLAUDE.local.md" >> $(WORKSPACE_DIR)/.gitignore
	@echo "Updated .gitignore with $$(jq '[.[].[] | .name] | length' $(REPOS_JSON)) repo entries"

## Report staleness of files listed in .contract-sources.
## Lines starting with # are comments; blank lines are ignored. Paths are
## relative to the workspace root. A file is "stale" if its mtime is newer
## than .claude/CLAUDE.md — the signal that contracts may have moved without
## the cross-repo doc being updated.
contracts-check:
	@if [ ! -f "$(CONTRACT_SOURCES)" ]; then \
		echo "No .contract-sources file. Create one at $(CONTRACT_SOURCES)"; \
		echo "List one contract file path per line (paths relative to workspace root)."; \
		exit 0; \
	fi
	@claude_md="$(WORKSPACE_DIR)/.claude/CLAUDE.md"; \
	if [ ! -f "$$claude_md" ]; then \
		echo "No .claude/CLAUDE.md found — contract freshness check skipped."; \
		exit 0; \
	fi; \
	claude_mtime=$$(stat -f %m "$$claude_md" 2>/dev/null || stat -c %Y "$$claude_md" 2>/dev/null); \
	stale=0; ok=0; missing=0; \
	while IFS= read -r line; do \
		case "$$line" in ''|'#'*) continue ;; esac; \
		path="$(WORKSPACE_DIR)/$$line"; \
		if [ ! -f "$$path" ]; then \
			echo "  \033[1;33m[missing]\033[0m $$line"; \
			missing=$$((missing+1)); \
			continue; \
		fi; \
		file_mtime=$$(stat -f %m "$$path" 2>/dev/null || stat -c %Y "$$path" 2>/dev/null); \
		if [ "$$file_mtime" -gt "$$claude_mtime" ]; then \
			echo "  \033[0;31m[stale]\033[0m   $$line (newer than CLAUDE.md)"; \
			stale=$$((stale+1)); \
		else \
			ok=$$((ok+1)); \
		fi; \
	done < "$(CONTRACT_SOURCES)"; \
	echo ""; \
	echo "Contracts checked: $$ok ok, $$stale stale, $$missing missing."; \
	if [ $$stale -gt 0 ]; then \
		echo "Stale files changed after CLAUDE.md was last updated — review cross-repo docs."; \
	fi

## Show available targets
help:
	@echo "Workspace Targets ($(words $(REPO_DIRS)) repos present):"
	@echo ""
	@echo "  make setup              Clone all repos"
	@echo "  make setup-full         Clone + bootstrap deps"
	@echo ""
	@echo "  make update             Pull latest across cloned repos"
	@echo "  make status             Git status across cloned repos"
	@echo "  make search QUERY='...' Search across cloned repos (uses rg if available)"
	@echo "  make contracts-check    Report staleness of files in .contract-sources"
	@echo "  make gitignore          Regenerate .gitignore from repos.json"
	@echo "  make help               Show this message"
	@echo ""
	@echo "Tag filtering: any target that operates across repos accepts TAGS=a,b."
	@echo "  e.g. make update TAGS=orders       Pull only repos tagged 'orders'"
	@echo "       make setup  TAGS=infra,shared Clone only repos tagged 'infra' or 'shared'"
