"use client";

import { Briefcase, ChevronDown, Layers, UserCircle } from "lucide-react";

export type AnswerModeItem = {
  slug: string;
  name: string;
  description?: string | null;
};

export type SceneTemplateItem = {
  slug: string;
  name: string;
  description?: string | null;
};

export type ProjectItem = {
  id: string;
  name: string;
  summary?: string | null;
  currentStage?: string | null;
};

export type ContextHints = {
  answerMode?: string;
  usedProfile?: boolean;
  usedProjectMemory?: boolean;
  usedConversationSummary?: boolean;
  usedSceneTemplate?: boolean;
  riskDetected?: boolean;
};

export function WorkspaceBar({
  answerModes,
  sceneTemplates,
  projects,
  answerModeSlug,
  sceneTemplateSlug,
  activeProjectId,
  contextHints,
  onAnswerModeChange,
  onSceneTemplateChange,
  onProjectChange,
  onOpenProfile,
  onOpenProjects,
}: {
  answerModes: AnswerModeItem[];
  sceneTemplates: SceneTemplateItem[];
  projects: ProjectItem[];
  answerModeSlug: string;
  sceneTemplateSlug: string;
  activeProjectId: string | null;
  contextHints: ContextHints | null;
  onAnswerModeChange: (slug: string) => void;
  onSceneTemplateChange: (slug: string) => void;
  onProjectChange: (id: string | null) => void;
  onOpenProfile: () => void;
  onOpenProjects: () => void;
}) {
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="border-b border-gray-100 bg-white/80 backdrop-blur px-3 py-2 md:px-4">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 md:gap-2 text-xs">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
          <Layers size={14} className="text-indigo-500" />
          <select
            value={answerModeSlug}
            onChange={(e) => onAnswerModeChange(e.target.value)}
            className="bg-transparent outline-none text-gray-700 max-w-[120px]"
            title="回答模式"
          >
            {answerModes.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
          <ChevronDown size={14} className="text-gray-400" />
          <select
            value={sceneTemplateSlug}
            onChange={(e) => onSceneTemplateChange(e.target.value)}
            className="bg-transparent outline-none text-gray-700 max-w-[140px]"
            title="场景模板"
          >
            <option value="">无模板</option>
            {sceneTemplates.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 min-w-0">
          <Briefcase size={14} className="text-indigo-500 flex-shrink-0" />
          <select
            value={activeProjectId ?? ""}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className="bg-transparent outline-none text-gray-700 max-w-[160px] truncate"
            title="当前项目"
          >
            <option value="">无项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onOpenProjects}
            className="text-indigo-600 hover:underline whitespace-nowrap"
          >
            管理
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-600 hover:bg-gray-50"
        >
          <UserCircle size={14} />
          画像
        </button>

        {activeProject && (
          <span className="text-gray-500 truncate max-w-[200px]">
            当前项目：{activeProject.name}
          </span>
        )}
      </div>

      {contextHints && (
        <div className="max-w-3xl mx-auto mt-1.5 flex flex-wrap gap-2 text-[11px] text-gray-400">
          <span>模式：{contextHints.answerMode ?? answerModeSlug}</span>
          {contextHints.usedProfile && <span>· 已结合用户画像</span>}
          {contextHints.usedProjectMemory && <span>· 已结合项目记忆</span>}
          {contextHints.usedConversationSummary && <span>· 已结合会话摘要</span>}
          {contextHints.usedSceneTemplate && <span>· 已应用场景模板</span>}
          {contextHints.riskDetected && <span className="text-amber-600">· 已启用边界提示</span>}
        </div>
      )}
    </div>
  );
}
