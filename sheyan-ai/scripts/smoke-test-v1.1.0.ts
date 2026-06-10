/**
 * v1.1.0 冒烟测试 — 需本地 dev 已启动 (127.0.0.1:3000)
 */
import { readFileSync } from "fs";

const BASE = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? "demo@sheyan.ai";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "SheyanDemo2026!";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@sheyan.ai";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "SheyanAdmin2026!";

type Result = { name: string; ok: boolean; detail?: string };

const results: Result[] = [];

function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) {
        const k = line.slice(0, i).trim();
        let v = line.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch {
    /* optional */
  }
}

function getCookie(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  const list = raw.length ? raw : [res.headers.get("set-cookie") ?? ""].filter(Boolean);
  return list.map((c) => c.split(";")[0]).join("; ");
}

async function login(email: string, password: string, portal: "user" | "admin" = "user") {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, portal }),
  });
  const data = await res.json();
  return { ok: res.ok, cookie: getCookie(res), data };
}

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  loadEnvLocal();
  console.log(`\n=== 设研AI v1.1.0 冒烟测试 @ ${BASE} ===\n`);

  // 0. Server up
  try {
    const ping = await fetch(BASE, { redirect: "manual" });
    record("服务可达", ping.status > 0, `status ${ping.status}`);
  } catch (e) {
    record("服务可达", false, String(e));
    printSummary();
    process.exit(1);
  }

  // 1. User login
  const userLogin = await login(DEMO_EMAIL, DEMO_PASSWORD);
  record("演示用户登录", userLogin.ok, userLogin.data.error?.message);
  if (!userLogin.ok) {
    printSummary();
    process.exit(1);
  }
  const userCookie = userLogin.cookie;

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: userCookie,
  };

  // 2. Answer modes
  const modesRes = await fetch(`${BASE}/api/answer-modes`, { headers: { Cookie: userCookie } });
  const modesData = await modesRes.json();
  record(
    "回答模式 API",
    modesRes.ok && (modesData.modes?.length ?? 0) >= 5,
    `${modesData.modes?.length ?? 0} 个模式`,
  );

  // 3. Scene templates
  const tplRes = await fetch(`${BASE}/api/scene-templates`, { headers: { Cookie: userCookie } });
  const tplData = await tplRes.json();
  record(
    "场景模板 API",
    tplRes.ok && (tplData.templates?.length ?? 0) >= 10,
    `${tplData.templates?.length ?? 0} 个模板`,
  );

  // 4. Profile CRUD
  const putProfile = await fetch(`${BASE}/api/profile`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      identitySummary: "产品创业者（测试）",
      outputPreference: "简洁结构化",
    }),
  });
  record("用户画像写入", putProfile.ok);

  const getProfile = await fetch(`${BASE}/api/profile`, { headers: { Cookie: userCookie } });
  const profileData = await getProfile.json();
  record(
    "用户画像读取",
    getProfile.ok && profileData.profile?.identitySummary?.includes("测试"),
  );

  // 5. Project + memory
  const createProject = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "冒烟测试项目", summary: "自动化测试用" }),
  });
  const projectData = await createProject.json();
  const projectId = projectData.project?.id as string | undefined;
  record("创建项目", createProject.ok && !!projectId);

  if (projectId) {
    const addMem = await fetch(`${BASE}/api/projects/${projectId}/memories`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ content: "核心用户是大学生", memoryType: "background" }),
    });
    record("添加项目记忆", addMem.ok);
  }

  // 6. Chat with deep mode (may cost points + API quota)
  const skipChat = process.env.SKIP_CHAT_TEST === "1";
  if (skipChat) {
    record("文本对话（深度分析）", true, "跳过 SKIP_CHAT_TEST=1");
  } else {
    const chatRes = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        message: "用三句话解释什么是 MVP",
        answerMode: "deep",
        projectId: projectId ?? null,
        useMemory: true,
      }),
    });
    const chatRaw = await chatRes.text();
    let chatData: { message?: { content?: string }; context?: { answerMode?: string }; error?: { message?: string } } = {};
    try {
      chatData = JSON.parse(chatRaw);
    } catch {
      /* */
    }
    const hasReply = Boolean(chatData.message?.content?.trim());
    record(
      "文本对话（深度分析）",
      chatRes.ok && hasReply,
      chatRes.ok
        ? `模式=${chatData.context?.answerMode ?? "?"} 字数≈${chatData.message?.content?.length ?? 0}`
        : chatData.error?.message ?? `HTTP ${chatRes.status}`,
    );
  }

  // 7. Admin workspace API
  const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD, "admin");
  record("管理员登录", adminLogin.ok);
  if (adminLogin.ok && userLogin.data.user?.id) {
    const userId = userLogin.data.user.id;
    const wsRes = await fetch(`${BASE}/api/admin/users/${userId}/workspace`, {
      headers: { Cookie: adminLogin.cookie },
    });
    const wsData = await wsRes.json();
    record(
      "管理员查看用户画像/项目",
      wsRes.ok && wsData.profile?.identitySummary?.includes("测试"),
      wsRes.ok ? `项目数 ${wsData.projects?.length ?? 0}` : wsData.error?.message,
    );
  } else {
    record("管理员查看用户画像/项目", false, "无法获取用户 ID 或管理员登录失败");
  }

  // Cleanup test project
  if (projectId) {
    await fetch(`${BASE}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Cookie: userCookie },
    });
  }

  printSummary();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== 汇总: ${passed}/${results.length} 通过 ===\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
