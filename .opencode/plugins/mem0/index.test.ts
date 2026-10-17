/**
 * Tests for the local mem0 plugin (OpenCode v2 API).
 *
 * Regression coverage for the original V1 failure:
 * the V2 loader only accepts a default export shaped like
 * `{ id: string, setup(ctx) }` (Plugin.define). @mem0/opencode-plugin
 * <= 0.4.1 exported a V1 plugin *function*, which failed with
 * `PluginModule.LoadError ... SchemaError(Expected object at ["default"])`.
 *
 * Run with:  bun test .opencode/plugins/mem0
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDefinition,
  normalizeScope,
  parseProjectFromRemote,
  redactSecrets,
  scopeSearchFilters,
  scopeWriteParams,
} from "./index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type FetchCall = { url: string; method: string; body: any };

/** Minimal fetch double that records calls and returns a JSON response. */
function mockFetch(handler: (url: string, method: string, body: any) => any = () => ({})) {
  const calls: FetchCall[] = [];
  const impl = async (url: string, init: any = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: String(url), method, body });
    const payload = handler(String(url), method, body) ?? {};
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as unknown as Response;
  };
  return { impl, calls };
}

/** Fake V2 plugin context capturing every registration the plugin makes. */
function fakeCtx() {
  const registered = {
    tools: [] as any[],
    sessionHooks: {} as Record<string, Array<(event: any) => any>>,
    shellHooks: {} as Record<string, Array<(event: any) => any>>,
    toolHooks: {} as Record<string, Array<(event: any) => any>>,
    skills: [] as any[],
    commands: [] as any[],
  };
  const ctx = {
    location: { directory: "/repo/ondina" },
    tool: {
      transform: async (cb: (editor: any) => void) =>
        cb({ add: (t: any) => registered.tools.push(t), list: () => registered.tools }),
    },
    session: {
      hook: async (name: string, cb: any) => {
        (registered.sessionHooks[name] ??= []).push(cb);
      },
      prompt: async () => undefined,
    },
    shell: {
      hook: async (name: string, cb: any) => {
        (registered.shellHooks[name] ??= []).push(cb);
      },
    },
    toolHooksCapture: undefined,
    skill: {
      transform: async (cb: (editor: any) => void) =>
        cb({ add: (s: any) => registered.skills.push(s), list: () => registered.skills }),
    },
    command: {
      transform: async (cb: (editor: any) => void) =>
        cb({ add: (c: any) => registered.commands.push(c) }),
    },
  };
  // tool hooks live on ctx.tool in the V2 API
  (ctx.tool as any).hook = async (name: string, cb: any) => {
    (registered.toolHooks[name] ??= []).push(cb);
  };
  return { ctx, registered };
}

function baseDeps(overrides: Record<string, unknown> = {}) {
  const { impl } = mockFetch();
  return {
    fetchImpl: impl as any,
    env: { MEM0_API_KEY: "test-key", MEM0_USER_ID: "tester" } as Record<string, string | undefined>,
    homeDir: "/home/does-not-exist-tests",
    runGit: async (args: string[]) => {
      if (args[0] === "remote") return "git@github.com:Cristhian-S1/ondina-erp.git";
      if (args[0] === "branch") return "develop";
      if (args[0] === "rev-parse") return "/repo/ondina";
      return "";
    },
    skillsDir: "/does-not-exist-skills",
    now: () => 1_760_000_000_000,
    randomHex: () => "abc123",
    log: () => {},
    ...overrides,
  };
}

async function setupWith(overrides: Record<string, unknown> = {}) {
  const { ctx, registered } = fakeCtx();
  const def = createDefinition(baseDeps(overrides));
  await def.setup(ctx as any);
  return { def, ctx, registered };
}

// ---------------------------------------------------------------------------
// Module contract — the exact regression that broke the npm plugin
// ---------------------------------------------------------------------------

describe("module contract (regression for err_f44f0ddf)", () => {
  test("default export is a V2 plugin definition with id and setup", async () => {
    const def = (await import("./index")).default;
    expect(typeof def.id).toBe("string");
    expect(def.id.length).toBeGreaterThan(0);
    expect(typeof def.setup).toBe("function");
    // not a V1 plugin function, not an Effect plugin
    expect(typeof (def as any).default).toBe("undefined");
    expect(typeof (def as any).effect).toBe("undefined");
  });
});

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe("identity", () => {
  test("parseProjectFromRemote derives owner-repo from git remotes", () => {
    expect(parseProjectFromRemote("git@github.com:Cristhian-S1/ondina-erp.git")).toBe(
      "Cristhian-S1-ondina-erp",
    );
    expect(parseProjectFromRemote("https://github.com/Mem0AI/mem0.git")).toBe("Mem0AI-mem0");
    expect(parseProjectFromRemote("ssh://git@example.com:2222/team/repo")).toBe("team-repo");
    expect(parseProjectFromRemote("origin")).toBeNull();
  });

  test("setup exposes identity through the shell env hook", async () => {
    const { registered } = await setupWith();
    const shellHook = registered.shellHooks["create.before"][0];
    const event: { env: Record<string, string | undefined> } = { env: {} };
    await shellHook(event);
    expect(event.env.MEM0_USER_ID).toBe("tester");
    expect(event.env.MEM0_APP_ID).toBe("Cristhian-S1-ondina-erp");
    expect(event.env.MEM0_BRANCH).toBe("develop");
    expect(event.env.MEM0_SESSION_ID).toMatch(/^ses_/);
  });

  test("MEM0_APP_ID overrides the git-derived app id", async () => {
    const { impl, calls } = mockFetch(() => ({ results: [] }));
    const { registered } = await setupWith({
      fetchImpl: impl,
      env: { MEM0_API_KEY: "test-key", MEM0_USER_ID: "tester", MEM0_APP_ID: "custom-app" },
    });
    const search = registered.tools.find((t: any) => t.name === "search_memories");
    await search.execute({ query: "hola mundo" });
    const call = calls.find((c) => c.url.includes("/v3/memories/search/"));
    expect(call!.body.filters).toEqual({ AND: [{ user_id: "tester" }, { app_id: "custom-app" }] });
  });
});

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

describe("secret redaction", () => {
  test("redacts common credential patterns", () => {
    expect(redactSecrets("api_key=sk-abcdef1234567890")).toContain("[REDACTED]");
    expect(redactSecrets("Authorization: Bearer abcdef123456")).toContain("[REDACTED]");
    expect(redactSecrets("password=hunter2SECRET")).not.toContain("hunter2SECRET");
  });

  test("add_memory sends redacted content and identity to the API", async () => {
    const { impl, calls } = mockFetch();
    const { registered } = await setupWith({ fetchImpl: impl });
    const addTool = registered.tools.find((t) => t.name === "add_memory");
    const res = await addTool.execute({ text: "password=hunter2SECRET plus a learning", infer: false });
    expect(typeof res.content).toBe("string");
    const call = calls.find((c) => c.url.includes("/v3/memories/add/"));
    expect(call).toBeDefined();
    expect(call!.method).toBe("POST");
    expect(call!.body.messages[0].content).toContain("[REDACTED]");
    expect(call!.body.messages[0].content).not.toContain("hunter2SECRET");
    expect(call!.body.user_id).toBe("tester");
    expect(call!.body.app_id).toBe("Cristhian-S1-ondina-erp");
    expect(call!.body.infer).toBe(false);
    expect(call!.body.metadata.confidence).toBe(0.7);
    expect(call!.body.metadata.source).toBe("opencode");
  });
});

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

describe("scopes", () => {
  const identity = { userId: "u1", appId: "a1", runId: "r1" };

  test("normalizeScope defaults to project", () => {
    expect(normalizeScope("session")).toBe("session");
    expect(normalizeScope("GLOBAL")).toBe("global");
    expect(normalizeScope("nonsense")).toBe("project");
    expect(normalizeScope(undefined)).toBe("project");
  });

  test("search filters: project isolates user+app, session adds run, global reads all", () => {
    expect(scopeSearchFilters("project", identity)).toEqual({
      AND: [{ user_id: "u1" }, { app_id: "a1" }],
    });
    expect(scopeSearchFilters("session", identity)).toEqual({
      AND: [{ user_id: "u1" }, { app_id: "a1" }, { run_id: "r1" }],
    });
    expect(scopeSearchFilters("global", identity)).toEqual({ user_id: "u1" });
  });

  test("global writes drop app_id", () => {
    expect(scopeWriteParams("project", identity)).toEqual({ user_id: "u1", app_id: "a1" });
    expect(scopeWriteParams("session", identity)).toEqual({ user_id: "u1", app_id: "a1", run_id: "r1" });
    expect(scopeWriteParams("global", identity)).toEqual({ user_id: "u1" });
  });
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

describe("tools", () => {
  test("registers the ten mem0 tools with JSON schemas", async () => {
    const { registered } = await setupWith();
    const names = registered.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "add_memory",
      "delete_all_memories",
      "delete_entities",
      "delete_memory",
      "get_event_status",
      "get_memories",
      "get_memory",
      "list_entities",
      "search_memories",
      "update_memory",
    ]);
    for (const tool of registered.tools) {
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.input.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  test("search_memories POSTs v3 search with scoped filters", async () => {
    const { impl, calls } = mockFetch((url) =>
      url.includes("/search/") ? { results: [{ id: "m1", memory: "hello" }] } : {},
    );
    const { registered } = await setupWith({ fetchImpl: impl });
    const tool = registered.tools.find((t) => t.name === "search_memories");
    const res = await tool.execute({ query: "ventas", top_k: 3 });
    const call = calls.find((c) => c.url.includes("/v3/memories/search/"));
    expect(call).toBeDefined();
    expect(call!.method).toBe("POST");
    expect(call!.body.query).toBe("ventas");
    expect(call!.body.top_k).toBe(3);
    expect(call!.body.output_format).toBe("v1.1");
    expect(call!.body.filters).toEqual({
      AND: [{ user_id: "tester" }, { app_id: "Cristhian-S1-ondina-erp" }],
    });
    expect(res.content).toContain("hello");
  });

  test("search with scope global uses a legally scoped filter (no wildcards)", async () => {
    const { impl, calls } = mockFetch(() => ({ results: [] }));
    const { registered } = await setupWith({ fetchImpl: impl });
    const tool = registered.tools.find((t) => t.name === "search_memories");
    await tool.execute({ query: "across projects", scope: "global" });
    const call = calls.find((c) => c.url.includes("/v3/memories/search/"));
    expect(call!.body.filters).toEqual({ user_id: "tester" });
  });

  test("get_event_status GETs the event endpoint", async () => {
    const { impl, calls } = mockFetch(() => ({ status: "SUCCEEDED" }));
    const { registered } = await setupWith({ fetchImpl: impl });
    const tool = registered.tools.find((t) => t.name === "get_event_status");
    await tool.execute({ event_id: "evt_123" });
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toContain("/v1/event/evt_123/");
  });

  test("delete_all_memories DELETEs with project entity params", async () => {
    const { impl, calls } = mockFetch(() => ({}));
    const { registered } = await setupWith({ fetchImpl: impl });
    const tool = registered.tools.find((t) => t.name === "delete_all_memories");
    await tool.execute({});
    const call = calls[0];
    expect(call.method).toBe("DELETE");
    expect(call.url).toContain("/v1/memories/?");
    expect(call.url).toContain("user_id=tester");
    expect(call.url).toContain("app_id=Cristhian-S1-ondina-erp");
  });

  test("delete_entities deletes whole entities by name through the v2 endpoint", async () => {
    const { impl, calls } = mockFetch(() => ({ message: "Entity deleted successfully." }));
    const { registered } = await setupWith({ fetchImpl: impl });
    const tool = registered.tools.find((t) => t.name === "delete_entities");
    const res = await tool.execute({ user_id: "opencode-mem0-selftest" });
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toContain("/v2/entities/user/opencode-mem0-selftest/");
    expect(res.content).toContain("Entity deleted successfully.");
  });
});

// ---------------------------------------------------------------------------
// Session hooks
// ---------------------------------------------------------------------------

describe("session hooks", () => {
  test("prompt hook stages context and context hook injects it once", async () => {
    const { impl } = mockFetch((url) => {
      if (url.includes("/v3/memories/search/")) {
        return { results: [{ id: "m2", memory: "use Supabase RLS" }] };
      }
      if (url.includes("/v3/memories/")) {
        return { count: 2, results: [{ id: "m1", memory: "prior decision" }] };
      }
      return {};
    });
    const { registered } = await setupWith({ fetchImpl: impl });

    const prompt = registered.sessionHooks["prompt"][0];
    const context = registered.sessionHooks["context"][0];

    await prompt({ sessionID: "s1", prompt: { text: "implementemos la HU de ventas" } });
    const event = {
      sessionID: "s1",
      system: [] as Array<{ type: string; text: string }>,
      messages: [],
      options: {},
      tools: {},
      agent: "build",
      model: {},
    };
    await context(event);
    expect(event.system.length).toBe(1);
    expect(event.system[0].text).toContain("## Mem0 Memory Context");
    expect(event.system[0].text).toContain("use Supabase RLS");

    const second = { ...event, system: [] as typeof event.system };
    await context(second);
    expect(second.system.length).toBe(0);
  });

  test("remember nudge becomes a context hint", async () => {
    const { impl } = mockFetch(() => ({ results: [] }));
    const { registered } = await setupWith({ fetchImpl: impl });
    const prompt = registered.sessionHooks["prompt"][0];
    const context = registered.sessionHooks["context"][0];
    await prompt({ sessionID: "s2", prompt: { text: "please remember this: usamos Conventional Commits" } });
    const event = {
      sessionID: "s2",
      system: [] as Array<{ type: string; text: string }>,
      messages: [],
      options: {},
      tools: {},
      agent: "build",
      model: {},
    };
    await context(event);
    expect(event.system[0].text).toContain("[MEMORY TRIGGER]");
  });

  test("execute.before blocks MEMORY.md writes", async () => {
    const { registered } = await setupWith();
    const guard = registered.toolHooks["execute.before"][0];
    expect(() => guard({ tool: "write", input: { filePath: "/repo/MEMORY.md" } })).toThrow();
    expect(() => guard({ tool: "edit", input: { file_path: "/repo/docs/x.md" } })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Skills and commands
// ---------------------------------------------------------------------------

describe("skills and commands", () => {
  test("loads vendored skills and registers /mem0-* commands", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mem0-skills-"));
    for (const name of ["mem0-scope", "mem0-remember"]) {
      mkdirSync(join(dir, name), { recursive: true });
      writeFileSync(
        join(dir, name, "SKILL.md"),
        `---\nname: ${name}\ndescription: Test skill ${name}\n---\n\n# ${name}\n`,
      );
    }
    const { registered } = await setupWith({ skillsDir: dir });
    expect(registered.skills.map((s) => s.id).sort()).toEqual(["mem0-remember", "mem0-scope"]);
    expect(registered.commands.map((c) => c.name).sort()).toEqual(["mem0-remember", "mem0-scope"]);
    const scopeSkill = registered.skills.find((s) => s.id === "mem0-scope");
    expect(scopeSkill.content).toContain("# mem0-scope");
    expect(scopeSkill.path).toContain("SKILL.md");
  });

  test("a missing skills dir is tolerated", async () => {
    const { registered } = await setupWith();
    expect(registered.skills.length).toBe(0);
    expect(registered.commands.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

describe("credentials", () => {
  test("setup without MEM0_API_KEY registers nothing and does not throw", async () => {
    const { registered } = await setupWith({ env: {} });
    expect(registered.tools.length).toBe(0);
    expect(Object.keys(registered.sessionHooks).length).toBe(0);
  });
});
