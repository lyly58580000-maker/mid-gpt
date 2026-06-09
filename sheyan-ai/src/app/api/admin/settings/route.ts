import { getAllConfigs, setConfig } from "@/lib/system-config";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const configs = await getAllConfigs();
    return jsonOk({ configs });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { configs?: Record<string, string> };
    if (!body.configs) throw new Error("INVALID_INPUT");

    for (const [key, value] of Object.entries(body.configs)) {
      await setConfig(key, value);
    }

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
