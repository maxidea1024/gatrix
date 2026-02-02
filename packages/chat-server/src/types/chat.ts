// 채널 관련 타입
export interface Channel {
  id: number;
  name: string;
  description?: string;
  type: "public" | "private" | "direct";
  maxMembers: number;
  isArchived: boolean;
  archiveReason?: string;
  avatarUrl?: string;
  settings?: ChannelSettings;
  ownerId: number;
  createdBy: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface ChannelSettings {
  allowFileUploads: boolean;
  allowReactions: boolean;
  allowInvites: boolean;
  slowMode: number; // 초 단위
  maxMessageLength: number;
  autoDeleteMessages: boolean;
  autoDeleteDays: number;
  requireApproval: boolean;
  allowedFileTypes: string[];
  maxFileSize: number;
}

export interface CreateChannelData {
  name: string;
  description?: string;
  type: "public" | "private" | "direct";
  maxMembers?: number;
  settings?: Partial<ChannelSettings>;
  memberIds?: number[];
}

export interface UpdateChannelData {
  name?: string;
  description?: string;
  maxMembers?: number;
  settings?: Partial<ChannelSettings>;
}

// 채널 멤버 관련 타입
export interface ChannelMember {
  id: number;
  channelId: number;
  userId: number;
  role: "owner" | "admin" | "moderator" | "member";
  permissions?: MemberPermissions;
  status: "active" | "muted" | "banned" | "left";
  mutedUntil?: Date;
  banReason?: string;
  lastReadMessageId: number;
  lastReadAt?: Date;
  unreadCount: number;
  notificationSettings?: NotificationSettings;
  joinedAt: Date;
  leftAt?: Date;
  updatedAt: Date;
}

export interface MemberPermissions {
  canSendMessages: boolean;
  canDeleteMessages: boolean;
  canEditMessages: boolean;
  canUploadFiles: boolean;
  canMentionEveryone: boolean;
  canManageMembers: boolean;
  canManageChannel: boolean;
  canPinMessages: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  mentions: boolean;
  allMessages: boolean;
  soundEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

// 메시지 관련 타입
export interface Message {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  contentType:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "file"
    | "location"
    | "system";
  messageData?: MessageData;
  replyToMessageId?: number;
  threadId?: number;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  systemMessageType?: string;
  systemMessageData?: any;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  // 관계형 데이터 (조인 시 포함)
  user?: User;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  replyToMessage?: Message;

  // 스레드 관련 필드 (조인 시 포함)
  threadCount?: number;
  lastThreadMessageAt?: Date;
}

export interface MessageData {
  mentions?: number[]; // 멘션된 사용자 ID 배열
  hashtags?: string[]; // 해시태그 배열
  links?: LinkPreview[]; // 링크 미리보기
  location?: LocationData; // 위치 정보
  poll?: PollData; // 투표 데이터
  formatting?: MessageFormatting; // 텍스트 포맷팅
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
}

export interface PollData {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  expiresAt?: Date;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  voters: number[];
}

export interface MessageFormatting {
  bold?: TextRange[];
  italic?: TextRange[];
  underline?: TextRange[];
  strikethrough?: TextRange[];
  code?: TextRange[];
  codeBlock?: CodeBlock[];
}

export interface TextRange {
  start: number;
  end: number;
}

export interface CodeBlock {
  start: number;
  end: number;
  language?: string;
}

export interface CreateMessageData {
  channelId: number;
  content: string;
  contentType?: "text" | "image" | "video" | "audio" | "file" | "location";
  messageData?: Partial<MessageData>;
  replyToMessageId?: number;
  threadId?: number;
}

export interface UpdateMessageData {
  content?: string;
  messageData?: Partial<MessageData>;
}

// 메시지 첨부파일 타입
export interface MessageAttachment {
  id: number;
  messageId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailPath?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  uploadStatus: "uploading" | "completed" | "failed";
  uploadProgress: number;
  createdAt: Date;
}

// 메시지 반응 타입
export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: Date;

  // 관계형 데이터
  user?: User;
}

// 사용자 관련 타입
export interface User {
  id: number; // Chat User ID
  gatrixUserId: number; // Gatrix User ID
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  status: string;
  lastSeenAt?: Date;
  isActive?: boolean;
}

export interface UserPresence {
  userId: number;
  status: "online" | "away" | "busy" | "offline";
  customStatus?: string;
  socketId?: string;
  serverId?: string;
  deviceType: "web" | "mobile" | "desktop";
  userAgent?: string;
  ipAddress?: string;
  lastSeenAt: Date;
  connectedAt?: Date;
  updatedAt: Date;
}

// 타이핑 인디케이터 타입
export interface TypingIndicator {
  id: number;
  channelId: number;
  userId: number;
  startedAt: Date;
  expiresAt: Date;

  // 관계형 데이터
  user?: User;
}

// 알림 관련 타입
export interface Notification {
  id: number;
  userId: number;
  type: "message" | "mention" | "channel_invite" | "system";
  title: string;
  content: string;
  channelId?: number;
  messageId?: number;
  senderUserId?: number;
  isRead: boolean;
  isDelivered: boolean;
  deliveryMethod: "push" | "email" | "sms" | "in_app";
  metadata?: any;
  createdAt: Date;
  readAt?: Date;
  deliveredAt?: Date;
  expiresAt?: Date;
}

// WebSocket 이벤트 타입
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: number;
  userId?: number;
  channelId?: number;
}

export interface SocketUser {
  id: number;
  socketId: string;
  userId: number;
  channels: Set<number>;
  lastActivity: Date;
  deviceType: "web" | "mobile" | "desktop";
  userAgent?: string;
  ipAddress?: string;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// 검색 관련 타입
export interface SearchQuery {
  query: string;
  channelId?: number;
  userId?: number;
  contentType?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachments?: boolean;
  isPinned?: boolean;
}

export interface SearchResult {
  messages: Message[];
  total: number;
  highlights: { [messageId: number]: string[] };
}

// 통계 관련 타입
export interface ChannelStats {
  channelId: number;
  totalMembers: number;
  activeMembers: number;
  onlineMembers: number;
  totalMessages: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  lastMessageAt?: Date;
  lastActivityAt?: Date;
  peakConcurrentUsers: number;
  updatedAt: Date;
}

export interface UserStats {
  userId: number;
  totalMessagesSent: number;
  messagesToday: number;
  messagesThisWeek: number;
  messagesThisMonth: number;
  totalChannelsJoined: number;
  activeChannels: number;
  firstMessageAt?: Date;
  lastMessageAt?: Date;
  totalOnlineTime: number;
  updatedAt: Date;
}
