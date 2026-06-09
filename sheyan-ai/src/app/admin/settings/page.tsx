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
};

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

  return (
    <div className="max-w-3xl bg-white rounded-2xl border divide-y">
      {configs.map((c) => (
        <div key={c.configKey} className="p-6 flex items-center justify-between">
          <div>
            <h4 className="font-medium">{LABELS[c.configKey] ?? c.configKey}</h4>
            <p className="text-sm text-gray-500 mt-1">{c.configKey}</p>
          </div>
          {c.configKey.includes("charge") ? (
            <span className="text-sm font-medium">{c.configValue} 点</span>
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
