"use client";

import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  text_enabled: "文本对话功能",
  image_enabled: "图片生成功能",
  register_enabled: "新用户注册",
  recharge_enabled: "充值入口",
  maintenance_mode: "系统维护模式",
  text_charge_points: "文本扣点",
  image_charge_points: "生图扣点",
  register_welcome_points: "新用户注册赠送",
  api_cost_cny_per_1k_tokens: "每千Token API成本(元)",
  api_cost_image_cny: "单次生图 API 成本(元)",
  quickrouter_recharge_discount: "QuickRouter充值折扣(0.99=9.9折)",
};

const NUMERIC_KEYS = new Set([
  "text_charge_points",
  "image_charge_points",
  "register_welcome_points",
  "api_cost_cny_per_1k_tokens",
  "api_cost_image_cny",
  "quickrouter_recharge_discount",
]);

export default function SettingsPage() {
  const [configs, setConfigs] = useState<{ configKey: string; configValue: string }[]>([]);

  const load = () => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => setConfigs(d.configs ?? []));
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key: string, current: string) => {
    const next = current === "true" ? "false" : "true";
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs: { [key]: next } }),
    });
    load();
  };

  const saveNumber = async (key: string, value: string) => {
    const isDecimal = key.includes("cny") || key.includes("discount");
    const n = isDecimal
      ? Math.max(0, Number(value) || 0)
      : Math.max(0, Math.floor(Number(value) || 0));
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs: { [key]: String(n) } }),
    });
    load();
  };

  return (
    <div className="max-w-3xl bg-white rounded-2xl border divide-y">
      {configs.map((c) => (
        <div key={c.configKey} className="p-6 flex items-center justify-between">
          <div>
            <h4 className="font-medium">{LABELS[c.configKey] ?? c.configKey}</h4>
            <p className="text-sm text-gray-500 mt-1">{c.configKey}</p>
          </div>
          {NUMERIC_KEYS.has(c.configKey) ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={c.configKey.includes("cny") || c.configKey.includes("discount") ? "0.0001" : "1"}
                defaultValue={c.configValue}
                key={`${c.configKey}-${c.configValue}`}
                onBlur={(e) => saveNumber(c.configKey, e.target.value)}
                className="w-24 px-2 py-1 text-sm border rounded-lg text-right"
              />
              <span className="text-sm text-gray-500">
                {c.configKey.includes("discount") ? "系数" : c.configKey.includes("cny") ? "元" : "点"}
              </span>
            </div>
          ) : (
            <button
              onClick={() => toggle(c.configKey, c.configValue)}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                c.configValue === "true" ? "bg-indigo-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  c.configValue === "true" ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
