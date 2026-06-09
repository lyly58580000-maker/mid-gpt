import { jsonOk } from "@/lib/api-response";

export async function GET() {
  return jsonOk({
    models: {
      text: {
        baseUrl: process.env.TEXT_API_BASE_URL,
        modelName: process.env.TEXT_MODEL_NAME,
        chargePoints: process.env.TEXT_CHARGE_POINTS ?? "1",
      },
      image: {
        baseUrl: process.env.IMAGE_API_BASE_URL,
        modelName: process.env.IMAGE_MODEL_NAME,
        fallbackModel: process.env.IMAGE_FALLBACK_MODEL,
        chargePoints: process.env.IMAGE_CHARGE_POINTS ?? "5",
      },
    },
    note: "API Key 通过环境变量配置，不在界面展示",
  });
}
