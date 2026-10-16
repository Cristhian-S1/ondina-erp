/**
 * Mem0 memory plugin for OpenCode v2 — project-local port.
 *
 * Ported from @mem0/opencode-plugin 0.4.1 (Apache-2.0, mem0ai/mem0,
 * integrations/opencode-plugin) after the npm package failed to load on
 * OpenCode 2.0.27 with:
 *
 *   PluginModule.LoadError: Plugin must export a default definition with an
 *   id and an effect or setup function. (SchemaError(Expected object at
 *   ["default"]))
 *
 * Root cause: the V1 plugin API exports a function that *returns* hooks,
 * while the V2 loader requires the default export to be a definition object
 * `{ id, setup(ctx) }` (see Plugin.define). V1 implementations do not run in
 * V2 (https://opencode.ai/v2/docs/build/plugins/migrate-v1).
 *
 * V1 -> V2 mapping applied here:
 *   chat.message                          -> ctx.session.hook("prompt")
 *   experimental.chat.messages.transform  -> ctx.session.hook("context") (event.system)
 *   experimental.session.compacting       -> ctx.session.hook("compaction")
 *   tool.execute.before/after             -> ctx.tool.hook("execute.before"/"execute.after")
 *   shell.env                             -> ctx.shell.hook("create.before")
 *   tool map                              -> ctx.tool.transform(editor.add)
 *   config (skills.paths, commands)       -> ctx.skill.transform / ctx.command.transform
 *
 * Design choices:
 * - Zero runtime dependencies: a small fetch-based client replicates the
 *   mem0ai@3.3.1 request semantics (v3 add/search/getAll, v1 memory/entities/event).
 * - Plain `{ id, setup }` default export (the V2 schema itself), so the
 *   module never needs `@opencode/plugin` at runtime.
 * - Secrets are redacted (ported from agent-plugin-core lifecycle.ts) before
 *   any text is sent to mem0.
 *
 * Identity (matches the previous V1 behavior so existing memories stay in scope):
 *   user_id  = MEM0_USER_ID  || OS username
 *   app_id   = MEM0_APP_ID   || "owner-repo" from the git remote
 *              (git@github.com:Cristhian-S1/ondina-erp.git -> "Cristhian-S1-ondina-erp")
 *   run_id   = generated per plugin load (memory scope = "session")
 * Credentials: MEM0_API_KEY, else MEM0_API_KEY= lines in ~/.zshrc, ~/.bashrc,
 * ~/.zprofile, ~/.bash_profile, ~/.profile.
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types (minimal structural types for the parts of the V2 context we use)
// ---------------------------------------------------------------------------

export type Scope = "project" | "session" | "global";

interface Identity {
  userId: string;
  appId: string;
  runId: string;
}

interface PluginDeps {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  env: Record<string, string | undefined>;
  homeDir: string;
  runGit: (args: string[], cwd?: string) => Promise<string>;
  skillsDir?: string;
  now: () => number;
  randomHex: () => string;
  log: (message: string) => void;
}

// The V2 plugin context surface used here. Types are structural on purpose:
// the runtime injects its own @opencode/plugin, and the module must load
// even without local typings resolved.
interface PluginContextLike {
  location?: { directory?: string };
  tool: {
    transform(cb: (editor: { add(tool: Record<string, unknown>): void }) => void): Promise<unknown>;
    hook(name: "execute.before" | "execute.after", cb: (event: any) => unknown): Promise<unknown>;
  };
  session: {
    hook(name: "prompt" | "context" | "compaction", cb: (event: any) => unknown): Promise<unknown>;
    prompt?(input: { sessionID: string; text: string; delivery?: unknown }): Promise<unknown>;
  };
  shell: {
    hook(name: "create.before", cb: (event: any) => unknown): Promise<unknown>;
  };
  skill?: {
    transform(cb: (editor: { add(skill: Record<string, unknown>): void }) => void): Promise<unknown>;
  };
  command?: {
    transform(cb: (editor: { add(command: Record<string, unknown>): void }) => void): Promise<unknown>;
  };
}

// ---------------------------------------------------------------------------
// Generic helpers (ported from the upstream V1 sources)
// ---------------------------------------------------------------------------

const MEM0_HOST = "https://api.mem0.ai";

const PROFILE_FILES = [".zshrc", ".bashrc", ".zprofile", ".bash_profile", ".profile"];

// Ported from integrations/agent-plugin-core/typescript/src/lifecycle.ts
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(authorization\s*[:=]\s*(?:bearer|token)\s+)[^\s"']+/gi, "$1[REDACTED]"],
  [
    /((?:api[_-]?key|secret[_-]?access[_-]?key|session[_-]?token)\s*[:=]\s*)[^\s"']+/gi,
    "$1[REDACTED]",
  ],
  [
    /((?:access[_-]?token|refresh[_-]?token|password|credential)\s*[:=]\s*)[^\s&"']+/gi,
    "$1[REDACTED]",
  ],
  [/\b(?:sk|m0|mem0_sk|psk)-[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]"],
  [/\b(?:ASIA|AKIA)[A-Z0-9]{12,}\b/g, "[REDACTED]"],
  [/\b(?:ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{12,}\b/g, "[REDACTED]"],
  [/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[REDACTED]"],
];

export function redactSecrets(value: unknown): string {
  let text =
    typeof value === "string" ? value : (JSON.stringify(value, null, 0) ?? String(value));
  for (const [pattern, replacement] of SECRET_PATTERNS) text = text.replace(pattern, replacement);
  return text;
}

function prepareUserText(value: unknown): string {
  return redactSecrets(value).trim();
}

/** `git@github.com:Cristhian-S1/ondina-erp.git` -> `Cristhian-S1-ondina-erp` */
export function parseProjectFromRemote(remote: string): string | null {
  const match = remote.trim().match(/[:/]([^/:]+)\/([^/:]+?)(?:\.git)?\/?$/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function parseApiKeyLine(line: string): string | undefined {
  const match = line.match(/^\s*(?:export\s+)?MEM0_API_KEY=(.*)$/);
  if (!match) return undefined;
  const value = match[1]
    .replace(/#.*$/, "")
    .trim()
    .replace(/^("|')(.*)\1$/, "$2")
    .trim();
  return value && !value.startsWith("$") ? value : undefined;
}

export function resolveApiKey(
  env: Record<string, string | undefined>,
  homeDir: string,
): string {
  const explicit = env.MEM0_API_KEY?.trim();
  if (explicit) return explicit;
  for (const profile of PROFILE_FILES) {
    try {
      const content = readFileSync(join(homeDir, profile), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const key = parseApiKeyLine(line);
        if (key) return key;
      }
    } catch {
      // Missing profile file — keep looking.
    }
  }
  return "";
}

function loadSettings(homeDir: string): Record<string, unknown> {
  try {
    const path = join(homeDir, ".mem0", "settings.json");
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function normalizeScope(value: unknown): Scope {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "session" || normalized === "global" ? normalized : "project";
}

export function scopeSearchFilters(scope: Scope, identity: Identity): Record<string, unknown> {
  // The v3 search API requires positively scoped filters (wildcards such as
  // { user_id: "*" } are rejected), so "global" spans every project of the
  // current user instead of every user.
  if (scope === "global") return { user_id: identity.userId };
  if (scope === "session") {
    return {
      AND: [
        { user_id: identity.userId },
        { app_id: identity.appId },
        { run_id: identity.runId },
      ],
    };
  }
  return { AND: [{ user_id: identity.userId }, { app_id: identity.appId }] };
}

export function scopeWriteParams(
  scope: Scope,
  identity: Identity,
): { user_id: string; app_id?: string; run_id?: string } {
  if (scope === "global") return { user_id: identity.userId };
  if (scope === "session") {
    return { user_id: identity.userId, app_id: identity.appId, run_id: identity.runId };
  }
  return { user_id: identity.userId, app_id: identity.appId };
}

export const SCOPE_GUIDANCE =
  'Memory tools accept an optional `scope`: omit it (or "project") for normal queries; use "session" to limit to the current run; use "global" only after the user enables /mem0-scope global.';

function extractMemories(res: any): Array<{ memory: string; id: string }> {
  const arr = res?.results ?? res;
  if (!Array.isArray(arr)) return [];
  return arr.map((m: any) => ({ memory: m.memory ?? "", id: m.id ?? "" }));
}

function countMemories(res: any): number {
  if (typeof res?.count === "number") return res.count;
  if (Array.isArray(res)) return res.length;
  if (Array.isArray(res?.results)) return res.results.length;
  return 0;
}

function parseFrontmatter(content: string): { name?: string; description?: string } {
  const block = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return {};
  const name = block[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = block[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  return { name, description };
}

interface SkillFile {
  id: string;
  name: string;
  description: string;
  path: string;
  content: string;
}

function loadSkills(dir: string | undefined): SkillFile[] {
  if (!dir || !existsSync(dir)) return [];
  const skills: SkillFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "SKILL.md");
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    const meta = parseFrontmatter(content);
    skills.push({
      id: entry.name,
      name: meta.name ?? entry.name,
      description: meta.description ?? `Mem0 ${entry.name} skill`,
      path: file,
      content,
    });
  }
  return skills.sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// mem0 REST client (mirrors mem0ai@3.3.1 request semantics, no dependencies)
// ---------------------------------------------------------------------------

interface MemoryClient {
  add(messages: unknown, options: Record<string, unknown>): Promise<any>;
  search(query: string, options?: Record<string, unknown>): Promise<any>;
  getAll(options?: Record<string, unknown>): Promise<any>;
  get(id: string): Promise<any>;
  update(id: string, body: Record<string, unknown>): Promise<any>;
  remove(id: string): Promise<any>;
  deleteAll(params: Record<string, unknown>): Promise<any>;
  users(options?: { page?: number; pageSize?: number }): Promise<any>;
  deleteEntities(params: {
    userId?: string;
    agentId?: string;
    appId?: string;
    runId?: string;
  }): Promise<any>;
  eventStatus(id: string): Promise<any>;
}

function createClient(deps: PluginDeps, apiKey: string): MemoryClient {
  async function request(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<any> {
    const response = await deps.fetchImpl(`${MEM0_HOST}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        "X-Mem0-Client": "opencode-plugin-local/1.0",
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Mem0 API ${response.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : {};
  }

  return {
    // v3 write path used by mem0ai >= 3.x
    add: (messages, options) =>
      request("/v3/memories/add/", { method: "POST", body: { messages, ...options } }),
    search: (query, options = {}) => {
      const { filters, ...rest } = options as Record<string, any>;
      return request("/v3/memories/search/", {
        method: "POST",
        body: { query, output_format: "v1.1", ...rest, ...(filters ? { filters } : {}) },
      });
    },
    getAll: (options = {}) => {
      const { page, pageSize, filters, ...rest } = options as Record<string, any>;
      const queryParams: string[] = [];
      if (page !== undefined) queryParams.push(`page=${page}`);
      if (pageSize !== undefined) queryParams.push(`page_size=${pageSize}`);
      const query = queryParams.length ? `?${queryParams.join("&")}` : "";
      return request(`/v3/memories/${query}`, {
        method: "POST",
        body: { ...rest, ...(filters ? { filters } : {}) },
      });
    },
    get: (id) => request(`/v1/memories/${encodeURIComponent(id)}/`),
    update: (id, body) =>
      request(`/v1/memories/${encodeURIComponent(id)}/`, { method: "PUT", body }),
    remove: (id) => request(`/v1/memories/${encodeURIComponent(id)}/`, { method: "DELETE" }),
    deleteAll: (params) => {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value != null) as Array<[string, string]>,
      );
      return request(`/v1/memories/?${query}`, { method: "DELETE" });
    },
    users: (options = {}) => {
      const queryParams: string[] = [];
      if (options.page !== undefined) queryParams.push(`page=${options.page}`);
      if (options.pageSize !== undefined) queryParams.push(`page_size=${options.pageSize}`);
      const query = queryParams.length ? `?${queryParams.join("&")}` : "";
      return request(`/v1/entities/${query}`);
    },
    deleteEntities: (params) => {
      const target = params.userId
        ? { type: "user", id: params.userId }
        : params.agentId
          ? { type: "agent", id: params.agentId }
          : params.appId
            ? { type: "app", id: params.appId }
            : params.runId
              ? { type: "run", id: params.runId }
              : null;
      if (!target) {
        throw new Error("delete_entities requires a user_id, agent_id, app_id or run_id");
      }
      // mem0ai@3.x deletes whole entities by name via the v2 endpoint
      // (the v1 endpoint expects a numeric entity id instead).
      return request(`/v2/entities/${target.type}/${encodeURIComponent(target.id)}/`, {
        method: "DELETE",
      });
    },
    eventStatus: (id) => request(`/v1/event/${encodeURIComponent(id)}/`),
  };
}

// ---------------------------------------------------------------------------
// Tool input schemas (JSON Schema — V2 tool.transform shape)
// ---------------------------------------------------------------------------

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const bool = (description: string) => ({ type: "boolean", description });
const objectSchema = (description: string) => ({
  type: "object",
  description,
  additionalProperties: true,
});

const NUDGE_RE =
  /\b(remember\s+(this|that)|memorize|save\s+this|note\s+(this|that)|don'?t\s+forget|always\s+remember|never\s+forget|keep\s+(this|that)\s+in\s+(mind|memory)|store\s+(this|that))\b/i;

const RESUME_RE =
  /where\s+(did\s+)?(we|I)\s+(leave|left)\s+off|continue\s+(from\s+)?(where|last)|what\s+were\s+we\s+(working|doing)|pick\s+up\s+where|resume\s+(from\s+|where\s+)|what.s\s+the\s+(current|latest)\s+(state|status)|catch\s+me\s+up|where\s+are\s+we/i;

const ERROR_STRONG_RE = /Traceback \(most recent call last\)|panic: |FATAL:|error\[E\d+\]/;
const ERROR_MULTI_RE = /(Error:|Exception:)/g;

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "write", "edit", "multiEdit"]);

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

function defaultDeps(): PluginDeps {
  return {
    fetchImpl: (url, init) => globalThis.fetch(url, init),
    env: process.env,
    homeDir: homedir(),
    runGit: async (args, cwd) =>
      String(
        execFileSync("git", args, {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      ).trim(),
    now: () => Date.now(),
    randomHex: () => randomBytes(3).toString("hex"),
    log: (message) => console.error(message),
  };
}

export function createDefinition(overrides: Partial<PluginDeps> = {}) {
  const deps: PluginDeps = { ...defaultDeps(), ...overrides };

  return {
    id: "mem0",
    async setup(ctx: PluginContextLike): Promise<void> {
      const directory = ctx.location?.directory ?? process.cwd();
      const apiKey = resolveApiKey(deps.env, deps.homeDir);
      if (!apiKey) {
        deps.log(
          "[mem0] MEM0_API_KEY is not set. Export it in your shell profile or environment; the plugin will not load memory tools without it.",
        );
        return;
      }

      // ---- identity -------------------------------------------------------
      const gitOut = async (args: string[]): Promise<string> => {
        try {
          return String(await deps.runGit(args, directory)).trim();
        } catch {
          return "";
        }
      };
      const userId =
        deps.env.MEM0_USER_ID?.trim() ||
        (() => {
          try {
            return userInfo().username;
          } catch {
            return deps.env.USER || deps.env.USERNAME || "unknown";
          }
        })();
      const remote = await gitOut(["remote", "get-url", "origin"]);
      const appId =
        deps.env.MEM0_APP_ID?.trim() ||
        parseProjectFromRemote(remote) ||
        basename((await gitOut(["rev-parse", "--show-toplevel"])) || directory);
      const branch = (await gitOut(["branch", "--show-current"])) || "main";
      const runId = `ses_${Math.floor(deps.now() / 1000)}_${deps.randomHex()}`;
      const identity: Identity = { userId, appId, runId };

      const client = createClient(deps, apiKey);
      const stats = { adds: 0, searches: 0, messages: 0 };
      const globalSearch = () => loadSettings(deps.homeDir).global_search === true;

      /** Scope used when no explicit filters/scope are passed (V1 parity). */
      const defaultFilters = (args: any = {}) => {
        // Legacy `global_search` setting: the current API cannot search across
        // users (wildcards are rejected), so this is user-wide across projects.
        if (globalSearch()) return { user_id: args.user_id ?? userId };
        if (args.agent_id) {
          return { AND: [{ agent_id: args.agent_id }, { app_id: args.app_id ?? appId }] };
        }
        return {
          AND: [{ user_id: args.user_id ?? userId }, { app_id: args.app_id ?? appId }],
        };
      };

      /** Ported from 0.4.1 resolveFilters: keep explicit filters isolated. */
      const resolveFilters = (args: any): any => {
        if (args.filters) {
          const existing = args.filters;
          if (typeof existing === "object" && existing !== null) {
            const andClauses = (existing as any).AND;
            if (Array.isArray(andClauses)) {
              const hasUid = andClauses.some((c: any) => c && typeof c === "object" && "user_id" in c);
              const hasAid = andClauses.some((c: any) => c && typeof c === "object" && "app_id" in c);
              const hasAgent = andClauses.some((c: any) => c && typeof c === "object" && "agent_id" in c);
              const next = [...andClauses];
              if (args.agent_id || hasAgent) {
                if (!hasAgent) next.push({ agent_id: args.agent_id });
              } else if (!hasUid) {
                next.push({ user_id: args.user_id ?? userId });
              }
              if (!hasAid) next.push({ app_id: args.app_id ?? appId });
              return { AND: next };
            }
            if (andClauses === undefined) {
              const hasAid = "app_id" in existing;
              const hasUid = "user_id" in existing;
              const hasAgent = "agent_id" in existing;
              if (!hasAid || (!hasUid && !hasAgent)) {
                const entries = Object.entries(existing).map(([k, v]) => ({ [k]: v }));
                if (args.agent_id || hasAgent) {
                  if (!hasAgent) entries.push({ agent_id: args.agent_id });
                } else if (!hasUid) {
                  entries.push({ user_id: args.user_id ?? userId });
                }
                if (!hasAid) entries.push({ app_id: args.app_id ?? appId });
                return { AND: entries };
              }
            }
          }
          return existing;
        }
        return defaultFilters(args);
      };

      const readScopeFilters = (args: any): any => {
        if (args.scope) return scopeSearchFilters(normalizeScope(args.scope), identity);
        if (args.filters || args.agent_id) return resolveFilters(args);
        const defaultScope = normalizeScope(loadSettings(deps.homeDir).default_scope);
        return defaultScope === "project"
          ? resolveFilters(args)
          : scopeSearchFilters(defaultScope, identity);
      };

      // ---- per-session state ---------------------------------------------
      interface SessionState {
        initialized: boolean;
        msgCount: number;
        memoryCount: number;
        pending: string[];
        seen: Set<string>;
      }
      const sessions = new Map<string, SessionState>();
      let lastSessionID = "";
      const getSession = (sessionID: string): SessionState => {
        let state = sessions.get(sessionID);
        if (!state) {
          state = { initialized: false, msgCount: 0, memoryCount: 0, pending: [], seen: new Set() };
          sessions.set(sessionID, state);
        }
        return state;
      };

      const sessionContextBlock = (items: string[]): string =>
        `## Mem0 Memory Context\n\n${items.join("\n\n")}`;

      // ---- tools ----------------------------------------------------------
      await ctx.tool.transform((editor) => {
        editor.add({
          name: "add_memory",
          description:
            "Add a new memory. This method is called everytime the user informs anything about themselves, their preferences, or anything that has any relevant information which can be useful in the future conversation. This can also be called when the user asks you to remember something. Set infer to false to store the memory verbatim without LLM fact extraction.",
          input: {
            type: "object",
            properties: {
              text: str("Memory text content"),
              user_id: str("User ID"),
              app_id: str("App/Project ID"),
              agent_id: str("Agent ID"),
              metadata: objectSchema("Metadata key-value pairs"),
              infer: bool("Set to false to store the memory verbatim without LLM fact extraction"),
              scope: str(
                'Write scope: "project" (this repo, default), "session" (this run), or "global" (user-wide, all projects). Use "global" only when explicitly asked.',
              ),
            },
            required: ["text"],
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const scope = normalizeScope(args.scope ?? loadSettings(deps.homeDir).default_scope);
            const writeParams = scopeWriteParams(scope, identity);
            const finalUserId = args.agent_id ? args.user_id : (args.user_id ?? writeParams.user_id);
            const finalAppId = args.app_id ?? writeParams.app_id;
            const metadata: Record<string, any> = { ...(args.metadata ?? {}) };
            if (metadata.confidence === undefined) metadata.confidence = 0.7;
            if (!metadata.source) metadata.source = "opencode";
            if (!metadata.type) metadata.type = "task_learning";
            if (!metadata.session_id) metadata.session_id = runId;
            if (!metadata.files) metadata.files = ["*"];
            if (!metadata.branch) metadata.branch = branch;
            let infer = args.infer;
            if (metadata.confidence >= 1.0 && infer === undefined) infer = false;
            const res = await client.add(
              [{ role: "user", content: prepareUserText(args.text) }],
              {
                user_id: finalUserId,
                app_id: finalAppId,
                run_id: writeParams.run_id,
                agent_id: args.agent_id,
                metadata,
                infer,
              },
            );
            stats.adds++;
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "search_memories",
          description:
            "Search stored memories by semantic relevance. Returns the memories that best match the query within the current scope.",
          input: {
            type: "object",
            properties: {
              query: str("What to search for in memory"),
              user_id: str("User ID"),
              app_id: str("App/Project ID"),
              agent_id: str("Agent ID"),
              filters: objectSchema("Key-value filters (e.g. metadata or user/app filters)"),
              limit: num("Maximum number of results to return (top_k)"),
              top_k: num("Maximum number of results to return (alternative parameter)"),
              scope: str(
                'Search scope: "project" (this repo, default), "session" (this run only), or "global" (across ALL your projects). Only use "global" when the user explicitly asks to search across projects.',
              ),
            },
            required: ["query"],
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const topK = args.limit ?? args.top_k ?? 10;
            const filters = readScopeFilters(args);
            const res = await client.search(prepareUserText(args.query), { filters, top_k: topK });
            stats.searches++;
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "get_memories",
          description:
            "List or browse stored memories without a search query -- useful for auditing what is remembered or paging through everything in a scope. To find memories relevant to a question, use search_memories instead (it ranks by semantic relevance).",
          input: {
            type: "object",
            properties: {
              user_id: str("User ID"),
              app_id: str("App/Project ID"),
              agent_id: str("Agent ID"),
              filters: objectSchema("Metadata/identity filters"),
              page: num("Page number"),
              page_size: num("Page size"),
              scope: str(
                'Scope: "project" (default), "session", or "global" (across ALL your projects). Use "global" only when explicitly asked.',
              ),
            },
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const filters = readScopeFilters(args);
            const res = await client.getAll({
              page: args.page,
              pageSize: args.page_size,
              filters,
            });
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "get_memory",
          description:
            "Fetch one memory by its exact ID (e.g. an ID returned by search_memories or get_memories) to read its full content and metadata.",
          input: {
            type: "object",
            properties: { id: str("The ID of the memory to retrieve") },
            required: ["id"],
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const res = await client.get(args.id);
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "update_memory",
          description:
            "Update an existing memory in place when a stored fact has changed -- requires the memory ID. Preserves the ID and history, so prefer this over deleting and re-adding.",
          input: {
            type: "object",
            properties: {
              id: str("The ID of the memory to update"),
              text: str("New text content for the memory"),
              metadata: objectSchema("New metadata key-value pairs"),
            },
            required: ["id"],
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const res = await client.update(args.id, {
              text: args.text === undefined ? undefined : prepareUserText(args.text),
              metadata: args.metadata,
            });
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "delete_memory",
          description:
            "Delete one or more memories by ID when they are wrong, obsolete, or the user asks to forget them. Irreversible -- only delete what is clearly no longer wanted.",
          input: {
            type: "object",
            properties: { id: str("The ID of the memory to delete") },
            required: ["id"],
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const res = await client.remove(args.id);
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "delete_all_memories",
          description:
            "Delete ALL memories in the given scope. Destructive and irreversible -- only use when the user explicitly asks to wipe their memory. Never call speculatively.",
          input: {
            type: "object",
            properties: {
              user_id: str("User ID whose memories to delete"),
              app_id: str("App ID whose memories to delete"),
              agent_id: str("Agent ID whose memories to delete"),
              scope: str(
                'Scope to delete: "project" (default), "session", or "global" (user-wide). Use "global" only when explicitly asked.',
              ),
            },
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const writeParams = args.scope
              ? scopeWriteParams(normalizeScope(args.scope), identity)
              : null;
            const res = await client.deleteAll({
              user_id: writeParams
                ? writeParams.user_id
                : args.agent_id
                  ? args.user_id
                  : (args.user_id ?? userId),
              app_id: writeParams ? writeParams.app_id : (args.app_id ?? appId),
              run_id: writeParams?.run_id,
              agent_id: args.agent_id,
            });
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "delete_entities",
          description:
            "Delete entire user/agent/app/run entities and every memory attached to them. Destructive and irreversible -- only on explicit user request to remove a whole user, agent, or project.",
          input: {
            type: "object",
            properties: {
              user_id: str("User ID of the entity to delete"),
              agent_id: str("Agent ID of the entity to delete"),
              app_id: str("App/Project ID of the entity to delete"),
              run_id: str("Run ID of the entity to delete"),
            },
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const res = await client.deleteEntities({
              userId: args.user_id,
              agentId: args.agent_id,
              appId: args.app_id,
              runId: args.run_id,
            });
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "list_entities",
          description:
            "List the user/agent/app/run entities that have memories. Use to discover which scopes exist before searching, listing, or deleting within a specific one.",
          input: {
            type: "object",
            properties: { page: num("Page number"), page_size: num("Page size") },
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const res = await client.users({ page: args.page, pageSize: args.page_size });
            return { content: JSON.stringify(res) };
          },
        });

        editor.add({
          name: "get_event_status",
          description:
            "Check whether an asynchronous memory write (add/update/delete) finished, using the event_id that call returned. Poll this when you need to confirm a write was persisted before relying on it.",
          input: {
            type: "object",
            properties: { event_id: str("The ID of the event/async operation to check") },
            required: ["event_id"],
            additionalProperties: false,
          },
          execute: async (args: any) => {
            const res = await client.eventStatus(args.event_id);
            return { content: JSON.stringify(res) };
          },
        });
      });

      // ---- session hooks ---------------------------------------------------
      // V2 equivalent of the V1 `chat.message` hook.
      await ctx.session.hook("prompt", async (event: any) => {
        const sessionID = String(event?.sessionID ?? "");
        if (!sessionID) return;
        lastSessionID = sessionID;
        const userText = prepareUserText(event?.prompt?.text ?? "");
        if (!userText || userText.length < 10) return;

        const state = getSession(sessionID);
        state.msgCount++;
        stats.messages++;

        if (!state.initialized) {
          state.initialized = true;
          try {
            const all = await client.getAll({ filters: defaultFilters(), page: 1, pageSize: 1 });
            state.memoryCount = countMemories(all);
            if (globalSearch()) {
              state.pending.push(
                `Global search is ON — searches return all memories for user_id="${userId}" across every project. Writes still use user_id="${userId}", app_id="${appId}".`,
              );
            } else {
              state.pending.push(
                `Always include user_id="${userId}" and app_id="${appId}" in every search_memories filter and add_memory call.`,
              );
            }
            if (state.memoryCount === 0) {
              state.pending.push(
                "New project with 0 memories. Capture decisions, conventions, and learnings as you work via the add_memory tool or the remember skill.",
              );
            } else {
              const res = await client.search("recent session state decisions and learnings", {
                filters: defaultFilters(),
                top_k: 5,
              });
              stats.searches++;
              const memories = extractMemories(res);
              if (memories.length > 0) {
                state.pending.push(
                  `Prior context from mem0:\n${memories.map((m) => `- ${m.memory}`).join("\n")}`,
                );
              }
            }
            state.pending.push(SCOPE_GUIDANCE);
          } catch {
            // Session init must never break prompting.
          }
        }

        if (NUDGE_RE.test(userText)) {
          state.pending.push(
            "[MEMORY TRIGGER] User asked to remember something. Call add_memory with the user's statement, confidence=1.0, infer=false.",
          );
        }

        const hasResume = RESUME_RE.test(userText);
        if (hasResume) {
          try {
            const [stateRes, decisionsRes] = await Promise.all([
              client.search("session state current task", {
                filters: defaultFilters(),
                top_k: 3,
              }),
              client.search("recent decisions and learnings", {
                filters: defaultFilters(),
                top_k: 3,
              }),
            ]);
            stats.searches += 2;
            const all = [...extractMemories(stateRes), ...extractMemories(decisionsRes)];
            const seen = new Set<string>();
            const unique = all.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
            if (unique.length > 0) {
              state.pending.push(
                `Session resume context:\n${unique.map((m) => `- ${m.memory}`).join("\n")}\n\nThese memories provide context for resuming work.`,
              );
            }
          } catch {
            // Best effort.
          }
        }

        if (!hasResume && state.memoryCount > 0) {
          try {
            const res = await client.search(userText, {
              filters: defaultFilters(),
              top_k: 5,
            });
            stats.searches++;
            const memories = extractMemories(res).filter((m) => {
              if (state.seen.has(m.id)) return false;
              state.seen.add(m.id);
              return true;
            });
            if (memories.length > 0) {
              state.pending.push(
                `Relevant memories:\n${memories.map((m) => `- ${m.memory}`).join("\n")}`,
              );
            }
          } catch {
            // Best effort.
          }
        }

        if (state.msgCount % 3 === 0) {
          void client
            .add([{ role: "user", content: userText }], {
              user_id: userId,
              app_id: appId,
              metadata: {
                type: "auto_capture",
                source: "opencode",
                confidence: 0.7,
                session_id: sessionID,
                branch,
              },
              infer: true,
            })
            .then(() => {
              stats.adds++;
            })
            .catch(() => {});
        }

        if (state.msgCount % 5 === 0 && stats.adds < Math.floor(state.msgCount / 3)) {
          state.pending.push(
            "After responding, store any new decisions, learnings, or preferences from this exchange via add_memory. Keep it to 1 sentence per memory.",
          );
        }
      });

      // V2 equivalent of `experimental.chat.messages.transform`: inject the
      // staged memory context into the model call's system prompt.
      await ctx.session.hook("context", (event: any) => {
        const state = sessions.get(String(event?.sessionID ?? ""));
        if (!state || state.pending.length === 0) return;
        const items = state.pending.splice(0, state.pending.length);
        if (Array.isArray(event?.system)) {
          event.system.push({ type: "text", text: sessionContextBlock(items) });
        }
      });

      // V2 equivalent of `experimental.session.compacting`.
      await ctx.session.hook("compaction", async (event: any) => {
        const sessionID = String(event?.sessionID ?? "");
        const summaryContent = `Session compacting. Project: ${appId}. Branch: ${branch}. Session: ${sessionID}. Stats: ${stats.adds} memories stored, ${stats.searches} searches, ${stats.messages} messages.`;
        void client
          .add([{ role: "user", content: summaryContent }], {
            user_id: userId,
            app_id: appId,
            metadata: {
              type: "session_state",
              source: "pre-compaction",
              session_id: sessionID,
              branch,
            },
            infer: true,
          })
          .then(() => {
            stats.adds++;
          })
          .catch(() => {});
        try {
          const res = await client.search("session state decisions learnings", {
            filters: defaultFilters(),
            top_k: 10,
          });
          stats.searches++;
          const memories = extractMemories(res);
          if (memories.length > 0 && Array.isArray(event?.system)) {
            event.system.push({
              type: "text",
              text: `## Mem0 Memories (preserve across compaction)\n\n${memories
                .map((m) => `- ${m.memory}`)
                .join("\n")}\n\nIMPORTANT: After compaction, store any key decisions or learnings using the add_memory tool.`,
            });
          }
        } catch {
          // Best effort.
        }
      });

      // V2 equivalent of the V1 `shell.env` hook.
      await ctx.shell.hook("create.before", (event: any) => {
        if (!event?.env) return;
        event.env.MEM0_USER_ID = userId;
        event.env.MEM0_APP_ID = appId;
        event.env.MEM0_SESSION_ID = runId;
        event.env.MEM0_BRANCH = branch;
        event.env.MEM0_GLOBAL_SEARCH = globalSearch() ? "true" : "false";
      });

      // V2 equivalents of `tool.execute.before` / `tool.execute.after`.
      await ctx.tool.hook("execute.before", (event: any) => {
        const toolName = String(event?.tool ?? "");
        if (!WRITE_TOOLS.has(toolName)) return;
        const input = event?.input ?? {};
        const filePath = String(input.filePath ?? input.file_path ?? "");
        if (/MEMORY\.md|\.claude\/memory/i.test(filePath)) {
          throw new Error("Use the add_memory tool instead of writing to MEMORY.md");
        }
      });

      await ctx.tool.hook("execute.after", (event: any) => {
        const toolName = String(event?.tool ?? "");
        if (toolName !== "bash" && toolName !== "shell") return;
        const output =
          event?.status === "error"
            ? String(event?.error?.message ?? "")
            : String(event?.result?.output ?? event?.result?.content ?? event?.result ?? "");
        if (output.length < 50) return;
        const command = String(event?.input?.command ?? "");
        if (/git\s+(commit|merge|rebase)/.test(command)) return;
        const hasStrongError = ERROR_STRONG_RE.test(output);
        const multiErrors = (output.match(ERROR_MULTI_RE) ?? []).length;
        if (!hasStrongError && multiErrors < 2) return;
        const errorLine =
          output
            .split("\n")
            .find((line) => /Error:|Exception:|panic:|FAIL:|fatal:/i.test(line))
            ?.replace(/^\s+/, "")
            .slice(0, 120) ?? "";
        if (errorLine.length < 10) return;
        const errorQuery = errorLine.slice(0, 80);
        const traceFiles = [
          ...new Set(
            output.match(/[a-zA-Z0-9_./-]+\.(py|ts|tsx|js|jsx|rs|go|rb|java|sh)(:\d+)?/g) ?? [],
          ),
        ].slice(0, 5);

        void (async () => {
          try {
            const res = await client.search(`error: ${errorQuery}`, {
              filters: defaultFilters(),
              top_k: 6,
            });
            stats.searches++;
            const memories = extractMemories(res);
            let text = `Error detected: \`${command.slice(0, 100)}\` produced:\n> ${errorLine}`;
            if (traceFiles.length > 0) {
              text += `\nFiles in stack trace: ${traceFiles.join(", ")}`;
            }
            if (memories.length > 0) {
              text += `\nPrior error memories:\n${memories.map((m) => `- ${m.memory}`).join("\n")}`;
            }
            text +=
              "\nStore resolved errors as anti_pattern or bug_fix memories for future reference.";
            const sessionID = String(event?.sessionID ?? lastSessionID);
            const state = sessions.get(sessionID);
            if (state) state.pending.push(text);
          } catch {
            // Best effort.
          }
        })();
      });

      // ---- skills + slash commands (V1 `config` hook replacement) ----------
      const skillsDir =
        deps.skillsDir ?? join(dirname(fileURLToPath(import.meta.url)), "skills");
      const skills = loadSkills(skillsDir);
      if (skills.length > 0) {
        try {
          await ctx.skill?.transform((editor) => {
            for (const skill of skills) {
              editor.add({
                id: skill.id,
                name: skill.name,
                description: skill.description,
                path: skill.path,
                content: skill.content,
              });
            }
          });
        } catch (error) {
          deps.log(`[mem0] skill registration failed: ${String(error)}`);
        }
        try {
          const identityLines = `Identity context (resolved at plugin startup):\n- user_id: ${userId}\n- app_id: ${appId}\n- session_id: ${runId}\n- branch: ${branch}`;
          await ctx.command?.transform((editor) => {
            for (const skill of skills) {
              editor.add({
                name: skill.id,
                description: skill.description,
                execute: async ({
                  sessionID,
                  prompt,
                  delivery,
                }: {
                  sessionID: string;
                  prompt: { text?: string };
                  delivery?: unknown;
                }) => {
                  const template = `Load and execute the \`${skill.id}\` skill.\n\nUse the mem0 memory tools (add_memory, search_memories, get_memories, get_memory, update_memory, delete_memory, delete_all_memories, delete_entities, list_entities, get_event_status) as instructed by the skill.\n\n${identityLines}`;
                  await ctx.session.prompt?.({ sessionID, text: template, delivery });
                },
              });
            }
          });
        } catch (error) {
          deps.log(`[mem0] command registration failed: ${String(error)}`);
        }
      }

      deps.log(
        `[mem0] loaded — user_id=${userId} app_id=${appId} branch=${branch} tools=10 skills=${skills.length}`,
      );
    },
  };
}

export default createDefinition();
