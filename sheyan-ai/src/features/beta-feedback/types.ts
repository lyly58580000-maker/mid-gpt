export type BetaFeedbackAttachment = {
  id: string;
  kind: "image";
  name: string;
  url: string;
  mimeType: string;
};

export type BetaFeedbackPublicItem = {
  id: string;
  publicAlias: string;
  content: string;
  attachments: BetaFeedbackAttachment[];
  status: "open" | "resolved";
  resolvedAt: string | null;
  resolvedNote: string | null;
  rewardPoints: number;
  rewardTier: string | null;
  createdAt: string;
};

export type BetaFeedbackAdminItem = BetaFeedbackPublicItem & {
  userId: string;
  userEmail: string;
  userNickname: string | null;
};
