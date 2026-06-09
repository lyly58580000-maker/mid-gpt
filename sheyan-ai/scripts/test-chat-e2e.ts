async function main() {
  const loginRes = await fetch("http://127.0.0.1:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "demo@sheyan.ai", password: "SheyanDemo2026!" }),
  });
  console.log("login status:", loginRes.status);
  const cookie = loginRes.headers.get("set-cookie") ?? "";
  console.log("cookie:", cookie.slice(0, 60) + "...");

  const chatRes = await fetch("http://127.0.0.1:3000/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie.split(";")[0],
    },
    body: JSON.stringify({ message: "hello" }),
  });
  console.log("chat status:", chatRes.status);
  console.log("chat body:", await chatRes.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
