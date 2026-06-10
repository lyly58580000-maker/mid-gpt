"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Image as ImageIcon,
  Plus,
  Folder,
  MoreHorizontal,
  Settings,
  LogOut,
  CreditCard,
  Clock,
  Send,
  Download,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  Copy,
  Check,
  Paperclip,
  FileText,
  Square,
  ChevronDown,
  Menu,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AssistantMarkdown } from "@/components/chat/markdown-message";
import { ImageEditorModal } from "@/components/chat/image-editor-modal";
import {
  WorkspaceBar,
  type AnswerModeItem,
  type ContextHints,
  type ProjectItem,
  type SceneTemplateItem,
} from "@/components/chat/workspace-bar";
import { ProfilePanel, ProjectPanel } from "@/components/chat/workspace-panels";
import {
  isAllowedMime,
  MAX_ATTACHMENTS,
  parseAttachments,
  type MessageAttachment,
} from "@/lib/attachments";
import { resolveImageRequest } from "@/lib/ai/image-intent";
import { compressImageForUpload } from "@/lib/client-image-compress";
import {
  consumeTextStream,
  createThrottledStreamWriter,
  isStreamingMessage,
} from "@/lib/chat-stream-client";

type Group = { id: string; name: string; count: number; isSystem: boolean; isDefault?: boolean };
type Chat = { id: string; title: string; groupId: string; updatedAt: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  contentType: "text" | "image";
  content: string;
  imageUrl?: string | null;
  attachments?: MessageAttachment[];
};

type PendingAttachment = {
  localId: string;
  file: File;
  previewUrl?: string;
  uploaded?: MessageAttachment;
  uploading?: boolean;
  compressing?: boolean;
  error?: string;
};

function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

function DropdownMenu({
  trigger,
  children,
  align = "right",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-30 mt-1 w-40 rounded-xl bg-white shadow-lg border py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function UserApp({ initialConversationId }: { initialConversationId?: string }) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState("all");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(() => new Set());
  const [balance, setBalance] = useState(0);
  const [userName, setUserName] = useState("用户");
  const [modal, setModal] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [usageRecords, setUsageRecords] = useState<
    {
      id: string;
      time: string;
      type: string;
      cost: string;
      status: string;
      duration?: string;
      error?: string;
    }[]
  >([]);
  const [generatingMeta, setGeneratingMeta] = useState<{
    kind: "text" | "image";
    elapsed: number;
  } | null>(null);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [renameGroupTarget, setRenameGroupTarget] = useState<Group | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [renameChatTarget, setRenameChatTarget] = useState<Chat | null>(null);
  const [chatTitleInput, setChatTitleInput] = useState("");
  const [errorHint, setErrorHint] = useState("");
  const [welcomeHint, setWelcomeHint] = useState("");
  const [answerModes, setAnswerModes] = useState<AnswerModeItem[]>([]);
  const [sceneTemplates, setSceneTemplates] = useState<SceneTemplateItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [answerModeSlug, setAnswerModeSlug] = useState("quick");
  const [sceneTemplateSlug, setSceneTemplateSlug] = useState("");
  const [lastContextHints, setLastContextHints] = useState<ContextHints | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [truncateFromMessageId, setTruncateFromMessageId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [imageEditorUrl, setImageEditorUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const generatingIdsRef = useRef<Set<string>>(new Set());
  const generatingTaskRef = useRef<Map<string, { kind: "text" | "image"; startedAt: number }>>(
    new Map(),
  );
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeChatRef = useRef<string | null>(activeChat);
  const conversationLoadIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const NEW_CHAT_KEY = "__new__";
  const chatSessionKey = (id: string | null) => id ?? NEW_CHAT_KEY;
  const activeSessionKey = chatSessionKey(activeChat);
  const isActiveChatGenerating = generatingIds.has(activeSessionKey);
  const hasActiveStreamMessage = messages.some(isStreamingMessage);
  const showGeneratingPlaceholder = isActiveChatGenerating && !hasActiveStreamMessage;

  const syncGeneratingState = () => {
    setGeneratingIds(new Set(generatingIdsRef.current));
  };

  const markGenerating = (key: string, kind: "text" | "image" = "text") => {
    generatingIdsRef.current.add(key);
    generatingTaskRef.current.set(key, { kind, startedAt: Date.now() });
    syncGeneratingState();
  };

  const unmarkGenerating = (key: string) => {
    generatingIdsRef.current.delete(key);
    generatingTaskRef.current.delete(key);
    syncGeneratingState();
  };

  useEffect(() => {
    if (!isActiveChatGenerating) {
      setGeneratingMeta(null);
      return;
    }
    const meta = generatingTaskRef.current.get(activeSessionKey);
    if (!meta) {
      setGeneratingMeta(null);
      return;
    }
    const tick = () => {
      setGeneratingMeta({
        kind: meta.kind,
        elapsed: Math.floor((Date.now() - meta.startedAt) / 1000),
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isActiveChatGenerating, activeSessionKey]);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const loadGroups = async () => {
    const res = await fetch("/api/groups");
    const data = await res.json();
    setGroups(data.groups ?? []);
  };

  const loadChats = async (groupId = activeGroup) => {
    const res = await fetch(`/api/conversations?groupId=${groupId}`);
    const data = await res.json();
    setChats(data.conversations ?? []);
  };

  const loadBalance = async () => {
    const me = await fetch("/api/auth/login");
    const meData = await me.json();
    if (meData.user) {
      setBalance(meData.user.balance);
      setUserName(meData.user.nickname ?? meData.user.email);
    }
  };

  const loadWorkspaceData = async () => {
    const [modesRes, templatesRes, projectsRes] = await Promise.all([
      fetch("/api/answer-modes"),
      fetch("/api/scene-templates"),
      fetch("/api/projects"),
    ]);
    const modesData = await modesRes.json();
    const templatesData = await templatesRes.json();
    const projectsData = await projectsRes.json();
    setAnswerModes(modesData.modes ?? []);
    setSceneTemplates(templatesData.templates ?? []);
    setProjects(projectsData.projects ?? []);
  };

  const getChatIdFromPath = () => {
    if (typeof window === "undefined") return initialConversationId ?? null;
    const match = window.location.pathname.match(/^\/chat\/([^/]+)$/);
    return match?.[1] ?? null;
  };

  const syncChatUrl = (id: string | null) => {
    const next = id ? `/chat/${id}` : "/chat";
    if (window.location.pathname !== next) {
      window.history.replaceState(null, "", next);
    }
  };

  const loadConversation = async (id: string) => {
    const loadId = ++conversationLoadIdRef.current;
    setLoadingConversation(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (loadId !== conversationLoadIdRef.current) return;
      if (!res.ok) {
        setErrorHint(data.error?.message ?? "加载对话失败");
        return;
      }
      if (data.conversation) {
        setActiveProjectId(data.conversation.projectId ?? null);
        setAnswerModeSlug(data.conversation.answerModeSlug ?? "quick");
        setSceneTemplateSlug(data.conversation.sceneTemplateSlug ?? "");
      }
      setMessages(
        (data.messages ?? [])
          .filter((m: Message) => m.role === "user" || m.content?.trim() || m.imageUrl)
          .map((m: Message & { attachments?: MessageAttachment[] | string | null }) => ({
            id: m.id,
            role: m.role,
            contentType: m.contentType,
            content: m.content,
            imageUrl: m.imageUrl,
            attachments: Array.isArray(m.attachments)
              ? m.attachments
              : parseAttachments(
                  typeof m.attachments === "string" ? m.attachments : undefined,
                ),
          })),
      );
      setErrorHint("");
    } finally {
      if (loadId === conversationLoadIdRef.current) {
        setLoadingConversation(false);
      }
    }
  };

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  const selectChat = (id: string) => {
    if (activeChat === id) {
      closeMobileSidebar();
      return;
    }
    conversationLoadIdRef.current += 1;
    setActiveChat(id);
    syncChatUrl(id);
    setErrorHint("");
    setInput("");
    setPendingAttachments([]);
    setTruncateFromMessageId(null);
    loadConversation(id);
    closeMobileSidebar();
  };

  useEffect(() => {
    loadGroups();
    loadBalance();
    loadWorkspaceData();

    const bonus = sessionStorage.getItem("welcome_bonus");
    if (bonus) {
      sessionStorage.removeItem("welcome_bonus");
      setWelcomeHint(`欢迎加入设研AI！已赠送 ${bonus} 点体验额度，快去试试吧`);
      window.setTimeout(() => setWelcomeHint(""), 8000);
    }

    const urlId = getChatIdFromPath();
    const startId = urlId ?? initialConversationId ?? null;
    if (startId) {
      setActiveChat(startId);
      loadConversation(startId);
    }

    const onPopState = () => {
      const id = getChatIdFromPath();
      setActiveChat(id);
      if (id) loadConversation(id);
      else {
        conversationLoadIdRef.current += 1;
        setMessages([]);
        setLoadingConversation(false);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadChats(activeGroup);
  }, [activeGroup]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  };

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom();
    }
  }, [messages, isActiveChatGenerating, showScrollBottom]);

  useEffect(() => {
    const root = chatScrollRef.current;
    const target = messagesEndRef.current;
    if (!root || !target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowScrollBottom(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: "0px 0px 80px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeChat, messages.length, isActiveChatGenerating]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNewChat = () => {
    conversationLoadIdRef.current += 1;
    setActiveChat(null);
    setMessages([]);
    setInput("");
    setPendingAttachments([]);
    setErrorHint("");
    setTruncateFromMessageId(null);
    setLoadingConversation(false);
    syncChatUrl(null);
    closeMobileSidebar();
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const pickValidFiles = (files: FileList | File[]) => {
    const all = Array.from(files).map((f, i) => {
      if (!f.name && f.type.startsWith("image/")) {
        const ext = f.type.split("/")[1] || "png";
        return new File([f], `粘贴图片-${Date.now()}-${i}.${ext}`, { type: f.type });
      }
      return f;
    });
    const valid = all.filter(
      (f) => f.type.startsWith("image/") || isAllowedMime(f.type, f.name),
    );
    if (valid.length < all.length) {
      setErrorHint("部分文件类型不支持，已自动跳过");
    }
    return valid;
  };

  const patchPending = (localId: string, patch: Partial<PendingAttachment>) => {
    setPendingAttachments((prev) =>
      prev.map((p) => (p.localId === localId ? { ...p, ...patch } : p)),
    );
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = pickValidFiles(files);
    if (list.length === 0) return;

    if (pendingAttachments.length + list.length > MAX_ATTACHMENTS) {
      setErrorHint(`最多添加 ${MAX_ATTACHMENTS} 个附件`);
      return;
    }

    const placeholders: PendingAttachment[] = list.map((file) => ({
      localId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      compressing: file.type.startsWith("image/") && file.type !== "image/gif",
      uploading: !file.type.startsWith("image/") || file.type === "image/gif",
    }));

    setPendingAttachments((prev) => [...prev, ...placeholders]);

    const prepared = await Promise.all(
      list.map(async (file, i) => {
        const ph = placeholders[i]!;
        if (file.type.startsWith("image/") && file.type !== "image/gif") {
          try {
            const compressed = await compressImageForUpload(file);
            patchPending(ph.localId, {
              file: compressed,
              compressing: false,
              uploading: true,
            });
            return compressed;
          } catch {
            patchPending(ph.localId, { compressing: false, uploading: true });
            return file;
          }
        }
        return file;
      }),
    );

    const form = new FormData();
    prepared.forEach((file) => form.append("files", file));

    const controller = new AbortController();
    const uploadTimer = window.setTimeout(() => controller.abort(), 90_000);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? "上传失败");
      }

      const uploaded = (data.attachments ?? []) as MessageAttachment[];
      setPendingAttachments((prev) => {
        const next = [...prev];
        placeholders.forEach((ph, i) => {
          const idx = next.findIndex((p) => p.localId === ph.localId);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              compressing: false,
              uploading: false,
              uploaded: uploaded[i],
            };
          }
        });
        return next;
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "上传超时，请检查网络或换一张较小的图片"
          : err instanceof Error
            ? err.message
            : "上传失败";
      setPendingAttachments((prev) =>
        prev.map((p) =>
          placeholders.some((ph) => ph.localId === p.localId)
            ? { ...p, compressing: false, uploading: false, error: msg }
            : p,
        ),
      );
      setErrorHint(msg);
    } finally {
      window.clearTimeout(uploadTimer);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (isActiveChatGenerating) return;
    if (e.dataTransfer.files?.length) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      uploadFiles(files);
    }
  };

  const removePendingAttachment = (localId: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((p) => p.localId === localId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  };

  const canSend =
    !isActiveChatGenerating &&
    (input.trim().length > 0 ||
      pendingAttachments.some((p) => p.uploaded && !p.error));

  const handleCopy = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setErrorHint("复制失败，请手动选择文本复制");
    }
  };

  const handleEdit = (msg: Message, index: number) => {
    if (isActiveChatGenerating) return;
    setInput(msg.content);
    setPendingAttachments([]);
    setMessages((prev) => prev.slice(0, index));
    setTruncateFromMessageId(msg.id.startsWith("temp-") ? null : msg.id);
    setErrorHint("");
  };

  const handleRegenerate = (assistantIndex: number) => {
    if (isActiveChatGenerating) return;
    const assistantMsg = messages[assistantIndex];
    if (assistantMsg.role !== "assistant") return;

    let userMsg: Message | null = null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    setMessages((prev) => prev.slice(0, assistantIndex - 1));
    setTruncateFromMessageId(userMsg.id.startsWith("temp-") ? null : userMsg.id);
    setErrorHint("");
    handleSend(userMsg.content, userMsg.attachments);
  };

  const handleStop = () => {
    const key = chatSessionKey(activeChatRef.current);
    abortControllersRef.current.get(key)?.abort();
  };

  const finishImageChatResponse = async (
    res: Response,
    opts: {
      chatAtStart: string | null;
      sessionKey: string;
      userMsg: Message;
      controller: AbortController;
    },
  ) => {
    let { sessionKey } = opts;
    const { chatAtStart, userMsg, controller } = opts;

    const headerConversationId = res.headers.get("X-Conversation-Id");
    const headerUserMessageId = res.headers.get("X-User-Message-Id");
    const conversationId = headerConversationId ?? undefined;

    if (conversationId && sessionKey === NEW_CHAT_KEY) {
      unmarkGenerating(NEW_CHAT_KEY);
      markGenerating(conversationId, "image");
      abortControllersRef.current.delete(NEW_CHAT_KEY);
      abortControllersRef.current.set(conversationId, controller);
      sessionKey = conversationId;
    }

    if (headerUserMessageId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsg.id ? { ...m, id: headerUserMessageId } : m)),
      );
    }

    const stillViewingSender =
      activeChatRef.current === chatAtStart ||
      (chatAtStart === null && activeChatRef.current === null) ||
      (conversationId != null && activeChatRef.current === conversationId);

    if (conversationId && stillViewingSender) {
      setActiveChat(conversationId);
      syncChatUrl(conversationId);
    }

    const raw = await res.text();
    let data: {
      conversationId?: string;
      message?: Message;
      error?: { message?: string };
    } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("服务器响应格式异常，请刷新后重试");
    }

    const jsonConversationId = data.conversationId ?? conversationId;
    if (jsonConversationId && stillViewingSender) {
      await loadConversation(jsonConversationId);
    }
    await loadChats(activeGroup);
    await loadBalance();
  };

  const handleImageEditSubmit = async ({
    prompt,
    maskDataUrl,
    previewDataUrl,
  }: {
    prompt: string;
    maskDataUrl: string | null;
    previewDataUrl: string | null;
  }) => {
    if (!imageEditorUrl) return;
    const sourceImageUrl = imageEditorUrl;
    const chatAtStart = activeChatRef.current;
    let sessionKey = chatSessionKey(chatAtStart);

    if (generatingIdsRef.current.has(sessionKey)) return;

    setImageEditorUrl(null);
    setErrorHint("");

    const maskPreviewAttachment: MessageAttachment | undefined =
      maskDataUrl && previewDataUrl
        ? {
            id: `mask-preview-${Date.now()}`,
            kind: "image",
            name: "蒙版预览",
            url: previewDataUrl,
            mimeType: "image/jpeg",
            size: 0,
          }
        : undefined;

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      contentType: "text",
      content: prompt,
      attachments: maskPreviewAttachment ? [maskPreviewAttachment] : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    markGenerating(sessionKey, "image");

    const controller = new AbortController();
    abortControllersRef.current.set(sessionKey, controller);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: prompt,
          imageEdit: {
            sourceImageUrl,
            maskDataUrl,
            maskPreviewDataUrl: previewDataUrl,
            prompt,
          },
          conversationId: chatAtStart,
          projectId: activeProjectId,
          groupId: activeGroup,
          answerMode: answerModeSlug,
          sceneTemplateId: sceneTemplateSlug || null,
          useMemory: true,
        }),
      });

      if (!res.ok) {
        const raw = await res.text();
        let errData: { error?: { message?: string } } = {};
        try {
          errData = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(`请求失败 (${res.status})，请刷新后重试`);
        }
        throw new Error(errData.error?.message ?? `请求失败 (${res.status})`);
      }

      await finishImageChatResponse(res, { chatAtStart, sessionKey, userMsg, controller });
    } catch (err) {
      const stillViewingSender = activeChatRef.current === chatAtStart;
      if (err instanceof Error && err.name === "AbortError") {
        if (stillViewingSender) {
          const reloadId = sessionKey !== NEW_CHAT_KEY ? sessionKey : chatAtStart;
          if (reloadId) await loadConversation(reloadId);
        }
        return;
      }
      const msg = err instanceof Error ? err.message : "图片编辑失败";
      if (stillViewingSender) {
        setErrorHint(msg);
        setMessages((prev) =>
          prev.filter((m) => !m.id.startsWith("temp-") && !m.id.startsWith("stream-")),
        );
      }
    } finally {
      unmarkGenerating(sessionKey);
      abortControllersRef.current.delete(sessionKey);
    }
  };

  const handleSend = async (text: string, attachmentOverride?: MessageAttachment[]) => {
    const readyAttachments =
      attachmentOverride ??
      pendingAttachments.filter((p) => p.uploaded && !p.error).map((p) => p.uploaded!);

    const chatAtStart = activeChatRef.current;
    let sessionKey = chatSessionKey(chatAtStart);

    if ((!text.trim() && readyAttachments.length === 0) || generatingIdsRef.current.has(sessionKey)) {
      return;
    }
    if (pendingAttachments.some((p) => p.uploading || p.compressing)) {
      setErrorHint("请等待附件处理完成");
      return;
    }

    setErrorHint("");
    const displayText =
      text.trim() ||
      (readyAttachments.some((a) => a.kind === "image") ? "请分析我上传的图片" : "请查看我上传的文档");

    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      contentType: "text",
      content: displayText,
      attachments: readyAttachments,
    };
    const willGenerateImage = resolveImageRequest({
      message: text.trim(),
      attachments: readyAttachments,
    }).shouldGenerate;
    const assistantStreamId = willGenerateImage ? null : `stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      ...(assistantStreamId
        ? [
            {
              id: assistantStreamId,
              role: "assistant" as const,
              contentType: "text" as const,
              content: "",
            },
          ]
        : []),
    ]);
    markGenerating(sessionKey, willGenerateImage ? "image" : "text");

    const editingFromId = truncateFromMessageId;
    setTruncateFromMessageId(null);
    setPendingAttachments([]);
    setInput("");

    const controller = new AbortController();
    abortControllersRef.current.set(sessionKey, controller);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: text.trim(),
          conversationId: chatAtStart,
          projectId: activeProjectId,
          groupId: activeGroup,
          attachments: readyAttachments,
          answerMode: answerModeSlug,
          sceneTemplateId: sceneTemplateSlug || null,
          useMemory: true,
          ...(editingFromId ? { truncateFromMessageId: editingFromId } : {}),
        }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      const headerConversationId = res.headers.get("X-Conversation-Id");
      const headerUserMessageId = res.headers.get("X-User-Message-Id");
      const promptContextB64 = res.headers.get("X-Prompt-Context");

      if (!res.ok) {
        const raw = await res.text();
        let errData: { error?: { message?: string } } = {};
        try {
          errData = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(`请求失败 (${res.status})，请刷新后重试`);
        }
        throw new Error(errData.error?.message ?? `请求失败 (${res.status})`);
      }

      if (promptContextB64) {
        try {
          setLastContextHints(JSON.parse(atob(promptContextB64)) as ContextHints);
        } catch {
          /* ignore */
        }
      }

      const conversationId = headerConversationId ?? undefined;

      if (conversationId && sessionKey === NEW_CHAT_KEY) {
        unmarkGenerating(NEW_CHAT_KEY);
        markGenerating(conversationId);
        abortControllersRef.current.delete(NEW_CHAT_KEY);
        abortControllersRef.current.set(conversationId, controller);
        sessionKey = conversationId;
      }

      if (headerUserMessageId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsg.id ? { ...m, id: headerUserMessageId } : m)),
        );
      }

      const stillViewingSender =
        activeChatRef.current === chatAtStart ||
        (chatAtStart === null && activeChatRef.current === null) ||
        (conversationId != null && activeChatRef.current === conversationId);

      if (conversationId && stillViewingSender) {
        setActiveChat(conversationId);
        syncChatUrl(conversationId);
      }

      if (contentType.includes("text/plain") && res.body && assistantStreamId) {
        const streamWriter = createThrottledStreamWriter((snapshot) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantStreamId ? { ...m, content: snapshot } : m)),
          );
        });

        await consumeTextStream(res.body, (snapshot) => streamWriter.push(snapshot));
        streamWriter.flush();

        if (conversationId && stillViewingSender) {
          await new Promise((r) => setTimeout(r, 400));
          await loadConversation(conversationId);
        }
      } else if (!contentType.includes("text/plain")) {
        const raw = await res.text();
        let data: { conversationId?: string; context?: ContextHints } = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error("服务器响应格式异常，请刷新后重试");
        }

        if (data.context) {
          setLastContextHints(data.context);
        }

        const jsonConversationId = data.conversationId ?? conversationId;
        if (jsonConversationId && sessionKey === NEW_CHAT_KEY) {
          unmarkGenerating(NEW_CHAT_KEY);
          markGenerating(jsonConversationId);
          abortControllersRef.current.delete(NEW_CHAT_KEY);
          abortControllersRef.current.set(jsonConversationId, controller);
          sessionKey = jsonConversationId;
        }

        const stillViewingJson =
          activeChatRef.current === chatAtStart ||
          (chatAtStart === null && activeChatRef.current === null) ||
          (jsonConversationId != null && activeChatRef.current === jsonConversationId);

        if (jsonConversationId && stillViewingJson) {
          setActiveChat(jsonConversationId);
          syncChatUrl(jsonConversationId);
          await loadConversation(jsonConversationId);
        }
      }

      await loadChats(activeGroup);
      await loadBalance();
    } catch (err) {
      const stillViewingSender = activeChatRef.current === chatAtStart;

      if (err instanceof Error && err.name === "AbortError") {
        if (stillViewingSender) {
          const reloadId = sessionKey !== NEW_CHAT_KEY ? sessionKey : chatAtStart;
          if (reloadId) await loadConversation(reloadId);
        }
        return;
      }

      const msg = err instanceof Error ? err.message : "发送失败";
      if (stillViewingSender) {
        setErrorHint(msg);
        setMessages((prev) =>
          prev.filter((m) => !m.id.startsWith("temp-") && !m.id.startsWith("stream-")),
        );
      }
      if (
        msg.includes("余额") ||
        msg.includes("quota") ||
        msg.includes("QuickRouter") ||
        msg.includes("API")
      ) {
        if (msg.includes("QuickRouter") || msg.includes("API 账户") || msg.includes("quota")) {
          setModal("apiQuota");
        } else {
          setModal("noBalance");
        }
      }
    } finally {
      unmarkGenerating(sessionKey);
      abortControllersRef.current.delete(sessionKey);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const openUsageHistory = async () => {
    const res = await fetch("/api/user/usage-records");
    const data = await res.json();
    setUsageRecords(data.records ?? []);
    setModal("history");
    setUserMenuOpen(false);
  };

  const activeChatTitle = chats.find((c) => c.id === activeChat)?.title;

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden">
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="关闭菜单"
          onClick={closeMobileSidebar}
        />
      )}

      {/* 左侧边栏：桌面常驻，手机抽屉 */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto flex h-[100dvh] w-[min(100vw,280px)] md:w-[280px] flex-shrink-0 flex-col border-r border-gray-200 bg-[#F9FAFB] transition-transform duration-300 ease-out ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-4 md:block">
          <h1 className="text-xl font-semibold text-gray-800 px-2 md:mb-4">设研ai</h1>
          <button
            type="button"
            onClick={closeMobileSidebar}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
            aria-label="关闭侧边栏"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-4 pb-4 md:pt-0 md:-mt-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <Plus size={16} /> 新建聊天
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 space-y-6 scrollbar-hide">
          {/* 分组管理 */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase">分组</span>
              <button
                onClick={() => {
                  setGroupNameInput("");
                  setModal("newGroup");
                }}
                className="text-gray-400 hover:text-gray-600"
                title="新建分组"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
                    activeGroup === group.id ? "bg-indigo-50 text-indigo-700" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => setActiveGroup(group.id)}>
                    <Folder size={16} />
                    <span className="text-sm truncate">{group.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">{group.count}</span>
                    {group.id !== "all" && !group.isSystem && (
                      <DropdownMenu
                        trigger={
                          <button className="p-1 text-gray-400 hover:text-gray-600 md:opacity-0 md:group-hover:opacity-100">
                            <MoreHorizontal size={14} />
                          </button>
                        }
                      >
                        <button
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                          onClick={() => {
                            setRenameGroupTarget(group);
                            setGroupNameInput(group.name);
                            setModal("renameGroup");
                          }}
                        >
                          <Pencil size={14} /> 重命名
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          onClick={() => {
                            setDeleteGroupTarget(group);
                            setModal("deleteGroup");
                          }}
                        >
                          <Trash2 size={14} /> 删除分组
                        </button>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 最近聊天 */}
          <div>
            <div className="px-3 mb-2 text-xs font-medium text-gray-500 uppercase">最近</div>
            <div className="space-y-1">
              {chats.length === 0 && (
                <p className="px-3 text-xs text-gray-400">暂无聊天记录</p>
              )}
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer ${
                    activeChat === chat.id ? "bg-white shadow-sm border border-gray-200" : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => selectChat(chat.id)}>
                    {generatingIds.has(chat.id) ? (
                      <RefreshCw size={16} className="text-indigo-500 animate-spin flex-shrink-0" />
                    ) : (
                      <MessageSquare size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-sm truncate">{chat.title}</span>
                  </div>
                  <DropdownMenu
                    trigger={
                      <button className="p-1 text-gray-400 hover:text-gray-600 md:opacity-0 md:group-hover:opacity-100">
                        <MoreHorizontal size={14} />
                      </button>
                    }
                  >
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setMoveTarget(chat.id);
                        setModal("moveChat");
                      }}
                    >
                      移动到分组
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setRenameChatTarget(chat);
                        setChatTitleInput(chat.title);
                        setModal("renameChat");
                      }}
                    >
                      重命名
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (!confirm("确定删除这条聊天？")) return;
                        await fetch(`/api/conversations/${chat.id}`, { method: "DELETE" });
                        if (activeChat === chat.id) handleNewChat();
                        loadChats(activeGroup);
                      }}
                    >
                      删除
                    </button>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 底部用户菜单 - 点击打开 */}
        <div className="p-3 border-t border-gray-200 relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm">
              {userName[0]}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-500">余额 {balance} 点</p>
            </div>
            <Settings size={16} className="text-gray-400" />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-lg border py-1 z-30">
              <div className="px-4 py-3 border-b">
                <p className="text-sm text-gray-500">当前余额</p>
                <p className="text-2xl font-semibold text-indigo-600">{balance} 点</p>
              </div>
              <button
                onClick={() => {
                  setModal("recharge");
                  setUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50"
              >
                <CreditCard size={16} /> 充值说明
              </button>
              <button onClick={openUsageHistory} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50">
                <Clock size={16} /> 使用记录
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} /> 退出登录
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 主聊天区 */}
      <div className="relative flex min-w-0 flex-1 flex-col h-[100dvh] bg-white">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-3 py-2.5 pr-14 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {activeChatTitle ?? "设研ai"}
            </p>
            {!activeChatTitle && (
              <p className="truncate text-[11px] text-gray-400">轻触菜单查看对话</p>
            )}
          </div>
        </div>
        <WorkspaceBar
          answerModes={answerModes}
          sceneTemplates={sceneTemplates}
          projects={projects}
          answerModeSlug={answerModeSlug}
          sceneTemplateSlug={sceneTemplateSlug}
          activeProjectId={activeProjectId}
          contextHints={lastContextHints}
          onAnswerModeChange={setAnswerModeSlug}
          onSceneTemplateChange={setSceneTemplateSlug}
          onProjectChange={setActiveProjectId}
          onOpenProfile={() => setModal("profile")}
          onOpenProjects={() => setModal("projects")}
        />
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {!activeChat && messages.length === 0 && !loadingConversation ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full px-6">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 border border-gray-100">
                <span className="text-xl font-bold text-gray-800">设研ai</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">有什么我可以帮您的？</h2>
              <p className="text-gray-500 mb-8">提问、创作文案，或输入「生成一张...」来创作图片。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full">
                <button
                  onClick={() => setInput("帮我写一段关于人工智能未来的短文")}
                  className="p-4 text-left border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-600"
                >
                  <MessageSquare size={16} className="mb-2 text-indigo-500" />
                  帮我写一段关于人工智能未来的短文
                </button>
                <button
                  onClick={() => setInput("生成一张赛博朋克风格的城市夜景图")}
                  className="p-4 text-left border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-600"
                >
                  <ImageIcon size={16} className="mb-2 text-indigo-500" />
                  生成一张赛博朋克风格的城市夜景图
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`max-w-3xl mx-auto space-y-6 md:space-y-8 pb-36 md:pb-32 transition-opacity duration-150 ${
                loadingConversation ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {loadingConversation && messages.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">加载对话中...</p>
              )}
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  className={`${msg.role === "user" ? "flex justify-end" : "w-full group"}`}
                >
                  <div
                    className={
                      msg.role === "user"
                        ? "max-w-[85%] sm:max-w-[80%] flex flex-col items-end"
                        : "w-full min-w-0"
                    }
                  >
                    <div
                      className={
                        msg.role === "user"
                          ? "bg-gray-100 px-5 py-3.5 rounded-2xl rounded-tr-sm"
                          : msg.contentType === "text"
                            ? "w-full py-1"
                            : "w-full"
                      }
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`flex flex-col gap-2 ${msg.content ? "mb-3" : ""}`}>
                          {msg.attachments.map((att) =>
                            att.kind === "image" ? (
                              <div key={att.id} className="flex flex-col items-end">
                                {att.name === "蒙版预览" ? (
                                  <span className="text-[11px] text-gray-400 mb-1">蒙版预览</span>
                                ) : null}
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block rounded-lg overflow-hidden border border-gray-200"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className={
                                      att.name === "蒙版预览"
                                        ? "max-h-64 max-w-[min(100%,420px)] w-auto object-contain bg-gray-50"
                                        : "max-h-40 max-w-[200px] object-cover"
                                    }
                                  />
                                </a>
                              </div>
                            ) : (
                              <div
                                key={att.id}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600"
                              >
                                <FileText size={14} className="text-indigo-500" />
                                <span className="max-w-[160px] truncate">{att.name}</span>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                      {msg.contentType === "image" && msg.imageUrl ? (
                        <div className="border rounded-2xl overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => !isActiveChatGenerating && setImageEditorUrl(msg.imageUrl!)}
                            disabled={isActiveChatGenerating}
                            className="block w-full text-left group disabled:cursor-wait"
                            title="点击放大并编辑"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.imageUrl}
                              alt={msg.content}
                              className="w-full max-h-[min(70vh,520px)] object-contain bg-gray-100 group-hover:opacity-95 transition-opacity"
                            />
                            <p className="px-3 py-1.5 text-xs text-center text-gray-400 bg-gray-50 border-t border-gray-100 group-hover:text-indigo-500">
                              点击放大 · 涂抹区域后可输入修改说明
                            </p>
                          </button>
                          <div className="p-4 flex items-center justify-between bg-gray-50 border-t border-gray-100">
                            <p className="text-sm text-gray-500 truncate flex-1 mr-4">{msg.content}</p>
                            <a
                              href={msg.imageUrl}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-sm text-indigo-600 border bg-white px-3 py-1.5 rounded-lg"
                            >
                              <Download size={14} /> 下载
                            </a>
                          </div>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <AssistantMarkdown
                          content={msg.content}
                          streaming={isStreamingMessage(msg)}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed text-[15px] text-gray-800">
                          {msg.content}
                        </div>
                      )}
                    </div>
                    {msg.role === "user" && msg.contentType === "text" && (
                      <div className="flex items-center gap-1 mt-1.5 mr-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                          title="复制"
                        >
                          {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          {copiedId === msg.id ? "已复制" : "复制"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(msg, index)}
                          disabled={isActiveChatGenerating}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40"
                          title="编辑并重新发送"
                        >
                          <Pencil size={13} />
                          编辑
                        </button>
                      </div>
                    )}
                    {msg.role === "assistant" && !isStreamingMessage(msg) && (
                      <div className="flex items-center gap-0.5 mt-2 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              msg.id,
                              msg.contentType === "image"
                                ? msg.content
                                : msg.content || "",
                            )
                          }
                          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="复制回答"
                        >
                          {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                          {copiedId === msg.id ? "已复制" : "复制"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegenerate(index)}
                          disabled={isActiveChatGenerating}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                          title="重新生成"
                        >
                          <RefreshCw size={14} />
                          重新生成
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {showGeneratingPlaceholder && (
                <div className="w-full py-1">
                  <span className="animate-pulse text-[15px] text-gray-500">
                    {generatingMeta?.kind === "image" ? "正在生图" : "正在思考"}
                    …
                    {generatingMeta && generatingMeta.elapsed > 0
                      ? `（${generatingMeta.elapsed}s）`
                      : ""}
                  </span>
                  {generatingMeta?.kind === "image" && (
                    <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                      {generatingMeta.elapsed >= 120 ? (
                        <>
                          QuickRouter 图生图上游仍无响应（{generatingMeta.elapsed}s）。
                          可点下方停止取消；超过 4 分钟会自动超时退款。
                        </>
                      ) : (
                        <>
                          图生图通常需 1–4 分钟，QuickRouter 上游偶发更慢。F12 网络里
                          <code className="mx-1 rounded bg-gray-200/80 px-1">/api/chat</code>
                          为 Pending 即仍在等待。
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {welcomeHint && (
          <div className="absolute bottom-28 left-0 right-0 px-4">
            <div className="max-w-3xl mx-auto bg-green-50 text-green-800 text-sm px-4 py-3 rounded-xl border border-green-100">
              {welcomeHint}
            </div>
          </div>
        )}

        {errorHint && (
          <div className="absolute bottom-28 left-0 right-0 px-4">
            <div className="max-w-3xl mx-auto bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
              {errorHint}
              {errorHint.includes("API") || errorHint.includes("api") || errorHint.includes("401") ? (
                <span className="block mt-1 text-xs">请检查 .env.local 中的 QuickRouter API Key 与 TEXT_API_BASE_URL 配置</span>
              ) : null}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white via-white to-transparent pt-12 md:pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-6 px-3 md:px-4 pointer-events-none">
          <div className="relative mx-auto max-w-3xl">
            {showScrollBottom && messages.length > 0 && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="pointer-events-auto absolute left-1/2 bottom-full z-40 mb-3 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gray-600/40 bg-gray-800/90 text-white shadow-lg transition-all hover:bg-gray-700"
                title="滑到底部"
              >
                <ChevronDown size={16} strokeWidth={2.5} />
              </button>
            )}
          <div
            className={`bg-white border rounded-2xl shadow-sm p-2 transition-colors relative pointer-events-auto ${
              isDragging ? "border-indigo-400 border-dashed bg-indigo-50/50" : "border-gray-200"
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-indigo-50/80 pointer-events-none">
                <p className="text-sm font-medium text-indigo-600">松开鼠标，添加图片或文档</p>
              </div>
            )}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2 pt-2 pb-1">
                {pendingAttachments.map((att) => (
                  <div
                    key={att.localId}
                    className="relative flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                  >
                    {att.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.previewUrl} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <FileText size={16} className="text-indigo-500" />
                    )}
                    <span className="max-w-[120px] truncate text-gray-600">{att.file.name}</span>
                    {att.compressing && <span className="text-gray-400">压缩中</span>}
                    {!att.compressing && att.uploading && (
                      <span className="text-gray-400">上传中</span>
                    )}
                    {!att.compressing && !att.uploading && att.uploaded && (
                      <span className="text-green-600">已就绪</span>
                    )}
                    {att.error && <span className="text-red-500">{att.error}</span>}
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(att.localId)}
                      className="p-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-end pl-10 pr-12">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isActiveChatGenerating || pendingAttachments.length >= MAX_ATTACHMENTS}
                className="absolute left-2 bottom-2 p-2 rounded-xl text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                title="上传图片或文档"
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx,.html,.xml,.log"
                onChange={(e) => {
                  if (e.target.files?.length) uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="输入问题，或粘贴图片与文档…"
                className="w-full max-h-[200px] min-h-[44px] bg-transparent resize-none outline-none py-2 px-2"
                rows={1}
              />
              {isActiveChatGenerating ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="absolute right-2 bottom-2 p-2 rounded-xl bg-gray-800 text-white hover:bg-gray-700"
                  title="停止回答"
                >
                  <Square size={16} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend(input)}
                  disabled={!canSend}
                  className={`absolute right-2 bottom-2 p-2 rounded-xl ${
                    canSend ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {imageEditorUrl ? (
        <ImageEditorModal
          imageUrl={imageEditorUrl}
          onClose={() => setImageEditorUrl(null)}
          onSubmit={handleImageEditSubmit}
          submitting={isActiveChatGenerating}
        />
      ) : null}

      {/* 弹窗 */}
      <Modal isOpen={modal === "profile"} onClose={() => setModal(null)} title="用户画像">
        <ProfilePanel onClose={() => setModal(null)} />
      </Modal>

      <Modal isOpen={modal === "projects"} onClose={() => setModal(null)} title="项目与记忆">
        <ProjectPanel
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectsChange={loadWorkspaceData}
          onSelectProject={setActiveProjectId}
          onClose={() => setModal(null)}
        />
      </Modal>

      <Modal isOpen={modal === "recharge"} onClose={() => setModal(null)} title="充值说明">
        <p className="text-sm text-gray-600 leading-relaxed">
          当前为人工充值模式。如需增加点数，请联系管理员并提供您的注册邮箱。管理员确认后将为您增加余额。
        </p>
      </Modal>

      <Modal isOpen={modal === "history"} onClose={() => setModal(null)} title="使用记录">
        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">时间</th>
                <th>类型</th>
                <th>消耗</th>
                <th>耗时</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {usageRecords.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2">{r.time}</td>
                  <td>{r.type}</td>
                  <td>{r.cost}</td>
                  <td>{r.duration || "—"}</td>
                  <td>
                    <span
                      className={
                        r.status === "进行中"
                          ? "text-amber-600"
                          : r.status === "失败" || r.status === "已退款"
                            ? "text-red-600"
                            : ""
                      }
                    >
                      {r.status}
                    </span>
                    {r.error ? (
                      <span className="block text-xs text-gray-400 mt-0.5">{r.error}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        isOpen={modal === "newGroup"}
        onClose={() => setModal(null)}
        title="新建分组"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">取消</button>
            <button
              onClick={async () => {
                if (!groupNameInput.trim()) return;
                await fetch("/api/groups", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: groupNameInput }),
                });
                setGroupNameInput("");
                setModal(null);
                loadGroups();
              }}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg"
            >
              确认
            </button>
          </>
        }
      >
        <input
          value={groupNameInput}
          onChange={(e) => setGroupNameInput(e.target.value)}
          placeholder="请输入分组名称，如：工作、学习、生图"
          className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </Modal>

      <Modal
        isOpen={modal === "renameGroup" && !!renameGroupTarget}
        onClose={() => setModal(null)}
        title="重命名分组"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">取消</button>
            <button
              onClick={async () => {
                if (!renameGroupTarget || !groupNameInput.trim()) return;
                await fetch(`/api/groups/${renameGroupTarget.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: groupNameInput }),
                });
                setModal(null);
                loadGroups();
              }}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg"
            >
              确认
            </button>
          </>
        }
      >
        <input
          value={groupNameInput}
          onChange={(e) => setGroupNameInput(e.target.value)}
          className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </Modal>

      <Modal isOpen={modal === "deleteGroup" && !!deleteGroupTarget} onClose={() => setModal(null)} title="删除分组">
        <p className="text-sm text-gray-600">
          确定删除分组「{deleteGroupTarget?.name}」？该分组下的聊天将移动到「默认分组」。
        </p>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">取消</button>
          <button
            onClick={async () => {
              if (!deleteGroupTarget) return;
              await fetch(`/api/groups/${deleteGroupTarget.id}`, { method: "DELETE" });
              setModal(null);
              loadGroups();
              loadChats(activeGroup);
            }}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg"
          >
            确认删除
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={modal === "moveChat" && !!moveTarget}
        onClose={() => setModal(null)}
        title="移动到分组"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">取消</button>
            <button
              onClick={async () => {
                const selected = document.querySelector<HTMLInputElement>('input[name="moveGroup"]:checked');
                if (!selected || !moveTarget) return;
                await fetch(`/api/conversations/${moveTarget}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ groupId: selected.value }),
                });
                setModal(null);
                loadChats(activeGroup);
                loadGroups();
              }}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg"
            >
              确认移动
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {groups.filter((g) => g.id !== "all").map((g) => (
            <label key={g.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" name="moveGroup" value={g.id} defaultChecked={g.isDefault} />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={modal === "renameChat" && !!renameChatTarget}
        onClose={() => setModal(null)}
        title="重命名聊天"
        footer={
          <>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100">取消</button>
            <button
              onClick={async () => {
                if (!renameChatTarget || !chatTitleInput.trim()) return;
                await fetch(`/api/conversations/${renameChatTarget.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ title: chatTitleInput }),
                });
                setModal(null);
                loadChats(activeGroup);
              }}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg"
            >
              确认
            </button>
          </>
        }
      >
        <input
          value={chatTitleInput}
          onChange={(e) => setChatTitleInput(e.target.value)}
          className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </Modal>

      <Modal isOpen={modal === "noBalance"} onClose={() => setModal(null)} title="提示">
        <div className="flex gap-3 p-4 bg-orange-50 text-orange-800 rounded-xl">
          <AlertCircle size={20} />
          <div>
            <p className="font-medium">平台点数不足</p>
            <p className="text-sm mt-1">请联系管理员充值后继续使用。</p>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modal === "apiQuota"} onClose={() => setModal(null)} title="API 账户问题">
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p className="font-medium text-gray-900">检测到 API 余额不足</p>
          <p>这不是设研AI 平台点数的问题，而是 API 服务商账户需要充值。请登录 QuickRouter 控制台检查余额后重试。</p>
        </div>
      </Modal>
    </div>
  );
}
