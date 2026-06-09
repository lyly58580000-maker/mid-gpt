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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import {
  isAllowedMime,
  MAX_ATTACHMENTS,
  parseAttachments,
  type MessageAttachment,
} from "@/lib/attachments";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [balance, setBalance] = useState(0);
  const [userName, setUserName] = useState("用户");
  const [modal, setModal] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [usageRecords, setUsageRecords] = useState<
    { id: string; time: string; type: string; cost: string; status: string }[]
  >([]);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [renameGroupTarget, setRenameGroupTarget] = useState<Group | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<Group | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [renameChatTarget, setRenameChatTarget] = useState<Chat | null>(null);
  const [chatTitleInput, setChatTitleInput] = useState("");
  const [errorHint, setErrorHint] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [truncateFromMessageId, setTruncateFromMessageId] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);

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

  const loadConversation = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (data.messages) {
      setMessages(
        data.messages
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
    }
  };

  const selectChat = (id: string) => {
    if (sendingRef.current) return;
    setActiveChat(id);
    loadConversation(id);
    router.replace(`/chat/${id}`);
  };

  useEffect(() => {
    loadGroups();
    loadBalance();
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [initialConversationId]);

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
  }, [messages, isGenerating, showScrollBottom]);

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
  }, [activeChat, messages.length, isGenerating]);

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
    if (sendingRef.current) return;
    setActiveChat(null);
    setMessages([]);
    setPendingAttachments([]);
    setErrorHint("");
    router.replace("/chat");
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
      uploading: true,
    }));

    setPendingAttachments((prev) => [...prev, ...placeholders]);

    const form = new FormData();
    list.forEach((file) => form.append("files", file));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
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
            next[idx] = { ...next[idx], uploading: false, uploaded: uploaded[i] };
          }
        });
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      setPendingAttachments((prev) =>
        prev.map((p) =>
          placeholders.some((ph) => ph.localId === p.localId)
            ? { ...p, uploading: false, error: msg }
            : p,
        ),
      );
      setErrorHint(msg);
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
    if (isGenerating) return;
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
    !isGenerating &&
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
    if (isGenerating) return;
    setInput(msg.content);
    setPendingAttachments([]);
    setMessages((prev) => prev.slice(0, index));
    setTruncateFromMessageId(msg.id.startsWith("temp-") ? null : msg.id);
    setErrorHint("");
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    sendingRef.current = false;
  };

  const handleSend = async (text: string) => {
    const readyAttachments = pendingAttachments
      .filter((p) => p.uploaded && !p.error)
      .map((p) => p.uploaded!);

    if ((!text.trim() && readyAttachments.length === 0) || isGenerating) return;
    if (pendingAttachments.some((p) => p.uploading)) {
      setErrorHint("请等待附件上传完成");
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
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);
    sendingRef.current = true;

    const editingFromId = truncateFromMessageId;
    setTruncateFromMessageId(null);
    setPendingAttachments([]);
    setInput("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: text.trim(),
          conversationId: activeChat,
          groupId: activeGroup,
          attachments: readyAttachments,
          ...(editingFromId ? { truncateFromMessageId: editingFromId } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as { error?: { message?: string } }).error?.message ?? `请求失败 (${res.status})`);
      }

      if (data.conversationId) {
        setActiveChat(data.conversationId);
        router.replace(`/chat/${data.conversationId}`);
        await loadConversation(data.conversationId);
      }

      await loadChats(activeGroup);
      await loadBalance();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        if (activeChat) await loadConversation(activeChat);
        return;
      }
      const msg = err instanceof Error ? err.message : "发送失败";
      setErrorHint(msg);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      if (msg.includes("余额") || msg.includes("quota") || msg.includes("API")) {
        if (msg.includes("QuickRouter") || msg.includes("API 账户")) setModal("apiQuota");
        else setModal("noBalance");
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
      sendingRef.current = false;
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 左侧边栏 */}
      <div className="w-[280px] bg-[#F9FAFB] border-r border-gray-200 flex flex-col h-screen flex-shrink-0">
        <div className="p-4">
          <h1 className="text-xl font-semibold text-gray-800 mb-4 px-2">设研ai</h1>
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            <Plus size={16} /> 新建聊天
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-6 scrollbar-hide">
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
                          <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600">
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
                    <MessageSquare size={16} className="text-gray-400" />
                    <span className="text-sm truncate">{chat.title}</span>
                  </div>
                  <DropdownMenu
                    trigger={
                      <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600">
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
      <div className="flex-1 flex flex-col h-screen bg-white relative">
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {!activeChat && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full px-6">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 border border-gray-100">
                <span className="text-xl font-bold text-gray-800">设研ai</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">有什么我可以帮您的？</h2>
              <p className="text-gray-500 mb-8">提问、创作文案，或输入「生成一张...」来创作图片。</p>
              <div className="grid grid-cols-2 gap-4 w-full">
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
            <div className="max-w-3xl mx-auto space-y-8 pb-32">
              {messages.map((msg, index) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-3 mt-1 text-white text-[10px] font-bold flex-shrink-0">
                      ai
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === "user" ? "flex flex-col items-end" : ""}`}>
                    <div
                      className={
                        msg.role === "user"
                          ? "bg-gray-100 px-5 py-3.5 rounded-2xl rounded-tr-sm"
                          : msg.contentType === "text"
                            ? "bg-gray-100 px-5 py-3.5 rounded-2xl rounded-tl-sm"
                            : ""
                      }
                    >
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`flex flex-wrap gap-2 ${msg.content ? "mb-3" : ""}`}>
                          {msg.attachments.map((att) =>
                            att.kind === "image" ? (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden border border-gray-200"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={att.url} alt={att.name} className="max-h-40 max-w-[200px] object-cover" />
                              </a>
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={msg.imageUrl} alt={msg.content} className="w-full max-h-[400px] object-cover" />
                          <div className="p-4 flex items-center justify-between bg-gray-50">
                            <p className="text-sm text-gray-500 truncate flex-1 mr-4">{msg.content}</p>
                            <a href={msg.imageUrl} download className="flex items-center gap-1.5 text-sm text-indigo-600 border bg-white px-3 py-1.5 rounded-lg">
                              <Download size={14} /> 下载
                            </a>
                          </div>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <MarkdownMessage content={msg.content || "..."} />
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
                          disabled={isGenerating}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40"
                          title="编辑并重新发送"
                        >
                          <Pencil size={13} />
                          编辑
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-3 mt-1 text-white text-[10px] font-bold flex-shrink-0">
                    ai
                  </div>
                  <div className="max-w-[80%] bg-gray-100 px-5 py-3.5 rounded-2xl rounded-tl-sm">
                    <span className="animate-pulse text-[15px] text-gray-500">正在思考...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

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

        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-white via-white to-transparent pt-16 pb-6 px-4 pointer-events-none">
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
                    {att.uploading && <span className="text-gray-400">上传中</span>}
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
                disabled={isGenerating || pendingAttachments.length >= MAX_ATTACHMENTS}
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="输入问题，或拖拽 / Ctrl+V 粘贴图片与文档..."
                className="w-full max-h-[200px] min-h-[44px] bg-transparent resize-none outline-none py-2 px-2"
                rows={1}
              />
              {isGenerating ? (
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

      {/* 弹窗 */}
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
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {usageRecords.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-2">{r.time}</td>
                  <td>{r.type}</td>
                  <td>{r.cost}</td>
                  <td>{r.status}</td>
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
