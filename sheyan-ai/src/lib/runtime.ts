export function isVercelRuntime() {
  return process.env.VERCEL === "1";
}
