"use client";

import { useEffect, useState } from "react";
import type { ProjectItem } from "@/components/chat/workspace-bar";

function Field({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600 mb-1 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
      />
    </label>
  );
}

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    identitySummary: "",
    preferenceSummary: "",
    commonTasks: "",
    dislikedStyles: "",
    outputPreference: "",
    expertiseLevel: "",
    interactionStyle: "",
  });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setForm({
            identitySummary: d.profile.identitySummary ?? "",
            preferenceSummary: d.profile.preferenceSummary ?? "",
            commonTasks: d.profile.commonTasks ?? "",
            dislikedStyles: d.profile.dislikedStyles ?? "",
            outputPreference: d.profile.outputPreference ?? "",
            expertiseLevel: d.profile.expertiseLevel ?? "",
            interactionStyle: d.profile.interactionStyle ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onClose();
  };

  const clear = async () => {
    if (!confirm("确定清空用户画像？")) return;
    await fetch("/api/profile", { method: "DELETE" });
    setForm({
      identitySummary: "",
      preferenceSummary: "",
      commonTasks: "",
      dislikedStyles: "",
      outputPreference: "",
      expertiseLevel: "",
      interactionStyle: "",
    });
  };

  if (loading) return <p className="text-sm text-gray-500">加载中...</p>;

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <p className="text-xs text-gray-500">平台根据你的长期使用习惯形成的理解，可手动编辑或清空。</p>
      <Field label="身份概括" value={form.identitySummary} onChange={(v) => setForm({ ...form, identitySummary: v })} />
      <Field label="偏好概括" value={form.preferenceSummary} onChange={(v) => setForm({ ...form, preferenceSummary: v })} />
      <Field label="常见任务" value={form.commonTasks} onChange={(v) => setForm({ ...form, commonTasks: v })} />
      <Field label="不喜欢的风格" value={form.dislikedStyles} onChange={(v) => setForm({ ...form, dislikedStyles: v })} />
      <Field label="输出偏好" value={form.outputPreference} onChange={(v) => setForm({ ...form, outputPreference: v })} />
      <Field label="专业水平" value={form.expertiseLevel} onChange={(v) => setForm({ ...form, expertiseLevel: v })} rows={1} />
      <Field label="交互习惯" value={form.interactionStyle} onChange={(v) => setForm({ ...form, interactionStyle: v })} />
      <div className="flex justify-between gap-2 pt-2">
        <button type="button" onClick={clear} className="text-sm text-red-600 hover:underline">
          清空画像
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border">
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Memory = {
  id: string;
  memoryType: string;
  content: string;
  confidence: number;
};

export function ProjectPanel({
  projects,
  activeProjectId,
  onProjectsChange,
  onSelectProject,
  onClose,
}: {
  projects: ProjectItem[];
  activeProjectId: string | null;
  onProjectsChange: () => void;
  onSelectProject: (id: string | null) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(activeProjectId ?? projects[0]?.id ?? "");
  const [projectForm, setProjectForm] = useState({
    name: "",
    type: "",
    summary: "",
    currentStage: "",
    keyDecisions: "",
    constraints: "",
  });
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newMemory, setNewMemory] = useState("");

  const loadProject = async (id: string) => {
    if (!id) return;
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    if (data.project) {
      setProjectForm({
        name: data.project.name ?? "",
        type: data.project.type ?? "",
        summary: data.project.summary ?? "",
        currentStage: data.project.currentStage ?? "",
        keyDecisions: data.project.keyDecisions ?? "",
        constraints: data.project.constraints ?? "",
      });
      setMemories(data.memories ?? []);
    }
  };

  useEffect(() => {
    if (selectedId) loadProject(selectedId);
  }, [selectedId]);

  const createProject = async () => {
    const name = prompt("项目名称");
    if (!name?.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    await onProjectsChange();
    if (data.project?.id) {
      setSelectedId(data.project.id);
      onSelectProject(data.project.id);
    }
  };

  const saveProject = async () => {
    if (!selectedId) return;
    await fetch(`/api/projects/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectForm),
    });
    await onProjectsChange();
  };

  const archiveProject = async () => {
    if (!selectedId || !confirm("归档此项目？对话将不再默认关联。")) return;
    await fetch(`/api/projects/${selectedId}`, { method: "DELETE" });
    await onProjectsChange();
    setSelectedId("");
    onSelectProject(null);
  };

  const addMemory = async () => {
    if (!selectedId || !newMemory.trim()) return;
    await fetch(`/api/projects/${selectedId}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMemory.trim(), memoryType: "note" }),
    });
    setNewMemory("");
    await loadProject(selectedId);
  };

  const deleteMemory = async (id: string) => {
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    if (selectedId) await loadProject(selectedId);
  };

  return (
    <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
      <div className="flex gap-2 items-center">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">选择项目</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={createProject} className="text-sm text-indigo-600 hover:underline">
          新建
        </button>
      </div>

      {selectedId ? (
        <>
          <Field label="项目名称" value={projectForm.name} onChange={(v) => setProjectForm({ ...projectForm, name: v })} rows={1} />
          <Field label="项目类型" value={projectForm.type} onChange={(v) => setProjectForm({ ...projectForm, type: v })} rows={1} />
          <Field label="项目简介" value={projectForm.summary} onChange={(v) => setProjectForm({ ...projectForm, summary: v })} />
          <Field label="当前阶段" value={projectForm.currentStage} onChange={(v) => setProjectForm({ ...projectForm, currentStage: v })} rows={1} />
          <Field label="核心决策" value={projectForm.keyDecisions} onChange={(v) => setProjectForm({ ...projectForm, keyDecisions: v })} />
          <Field label="项目约束" value={projectForm.constraints} onChange={(v) => setProjectForm({ ...projectForm, constraints: v })} />

          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-800 mb-2">项目记忆</p>
            <div className="space-y-2 mb-2">
              {memories.map((m) => (
                <div key={m.id} className="flex gap-2 items-start text-sm bg-gray-50 rounded-lg p-2">
                  <div className="flex-1">
                    <span className="text-xs text-gray-400">[{m.memoryType}]</span> {m.content}
                  </div>
                  <button type="button" onClick={() => deleteMemory(m.id)} className="text-red-500 text-xs">
                    删除
                  </button>
                </div>
              ))}
              {memories.length === 0 && <p className="text-xs text-gray-400">暂无记忆条目</p>}
            </div>
            <div className="flex gap-2">
              <input
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="添加项目记忆..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={addMemory} className="px-3 py-2 text-sm bg-gray-100 rounded-lg">
                添加
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button type="button" onClick={archiveProject} className="text-sm text-red-600 hover:underline">
              归档项目
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => { onSelectProject(selectedId); onClose(); }} className="px-4 py-2 text-sm rounded-lg border">
                设为当前
              </button>
              <button type="button" onClick={saveProject} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white">
                保存
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">请新建或选择一个项目</p>
      )}
    </div>
  );
}
