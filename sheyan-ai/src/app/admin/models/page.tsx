"use client";

import { useEffect, useState } from "react";

export default function ModelsPage() {
  const [models, setModels] = useState<{
    text: { baseUrl?: string; modelName?: string; chargePoints?: string };
    image: { baseUrl?: string; modelName?: string; fallbackModel?: string; chargePoints?: string };
    note?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/models")
      .then((r) => r.json())
      .then((d) => setModels({ ...d.models, note: d.note }));
  }, []);

  if (!models) return <div>加载中...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold mb-4">文本模型 (GPT)</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Base URL</dt><dd>{models.text.baseUrl}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">模型名</dt><dd>{models.text.modelName}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">扣点</dt><dd>{models.text.chargePoints} 点/次</dd></div>
        </dl>
      </div>
      <div className="bg-white rounded-2xl border p-6">
        <h3 className="font-semibold mb-4">生图模型 (Image2)</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Base URL</dt><dd>{models.image.baseUrl}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">主模型</dt><dd>{models.image.modelName}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">备用模型</dt><dd>{models.image.fallbackModel}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">扣点</dt><dd>{models.image.chargePoints} 点/次</dd></div>
        </dl>
      </div>
      <p className="text-sm text-gray-500">API Key 通过服务器环境变量配置，如需更换请修改 `.env.local` 后重启服务。</p>
    </div>
  );
}
