// Chat related types and interfaces

export interface User {
  id: number;
  userId?: number;
  username: string;
  name?: string;
  email: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen?: string;
  lastSeenAt?: string;
  status?: UserStatus;
  role?: string;
}

export interface Channel {
  id: number;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  unreadCount?: number;
  lastMessage?: Message;
  isArchived: boolean;
  settings: ChannelSettings;
  members?: ChannelMember[];
}

export interface ChannelSettings {
  allowFileUpload: boolean;
  allowImageUpload: boolean;
  allowVideoUpload: boolean;
  maxFileSize: number; // in bytes
  retentionDays?: number; // message retention period
  isReadOnly: boolean;
}

export interface ChannelMember {
  id: number;
  channelId: number;
  userId: number;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  lastReadAt?: string;
  user: User;
}

export interface Message {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  type: MessageType;
  metadata?: MessageMetadata;
  replyToId?: number;
  threadId?: number;
  threadCount?: number;
  lastThreadMessageAt?: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  replyTo?: Message;
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  mentions: MessageMention[];
  hashtags: string[];
  isEdited?: boolean;
  readBy?: any[];
  status?: MessageStatus;
  location?: LocationData;
}

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'link'
  | 'system'
  | 'emoji';

export interface MessageMetadata {
  linkPreview?: LinkPreview;
  location?: LocationData;
  editHistory?: EditHistory[];
  systemEventType?: SystemEventType;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  author?: string;
  readingTime?: string;
  publishedTime?: string;
  type?: 'website' | 'article' | 'video' | 'image';
  favicon?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
  name?: string;
}

export interface EditHistory {
  content: string;
  editedAt: string;
}

export type SystemEventType =
  | 'user_joined'
  | 'user_left'
  | 'channel_created'
  | 'channel_updated'
  | 'member_added'
  | 'member_removed';

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: string;
  user: User;
}

export interface MessageAttachment {
  id: number;
  messageId: number;
  fileName: string;
  originalName: string;
  name?: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number; // for video/audio files
  createdAt: string;
}

export interface MessageMention {
  id: number;
  messageId: number;
  userId: number;
  startIndex: number;
  endIndex: number;
  user: User;
}

export interface TypingIndicator {
  channelId: number;
  userId: number;
  user: User;
  timestamp: string;
  threadId?: number; // 스레드 타이핑인 경우
}

export interface ChatNotification {
  id: number;
  type: NotificationType;
  channelId: number;
  messageId?: number;
  userId: number;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  channel: Channel;
  user: User;
  message?: Message;
}

export type NotificationType =
  | 'new_message'
  | 'mention'
  | 'reply'
  | 'channel_invite'
  | 'user_joined'
  | 'user_left';

// WebSocket event types
export interface WebSocketEvent {
  type: WebSocketEventType;
  data: any;
  timestamp: string;
}

export type WebSocketEventType =
  // 서버 → 클라이언트 Event (서버에서 실제로 emit하는 이벤트들)
  | 'connected' // 연결 Success
  | 'error' // 오류 발생
  | 'message_sent' // 메시지 전송 완료
  | 'user_typing' // 타이핑 시작 Notification
  | 'user_stop_typing' // 타이핑 중지 Notification
  | 'user_typing_thread' // 스레드 타이핑 시작 Notification
  | 'user_stop_typing_thread' // 스레드 타이핑 중지 Notification
  | 'user_status_changed' // Used자 Status 변경 Notification
  | 'user_left' // Used자 채널 퇴장 Notification
  | 'message' // 일반 메시지 (MessageController)
  | 'new_message' // 새 메시지 (BroadcastService)

  // 클라이언트 → 서버 Event (클라이언트에서 서버로 보내는 이벤트들)
  | 'join_channel' // 채널 입장
  | 'leave_channel' // 채널 퇴장
  | 'send_message' // 메시지 전송
  | 'start_typing' // 타이핑 시작
  | 'stop_typing' // 타이핑 중지
  | 'mark_read' // 메시지 읽음 처리
  | 'update_status' // Update state
  | 'activity' // 활동 업데이트

  // 클라이언트 내부 Event (프론트엔드에서만 Used)
  | 'message_created' // 메시지 Create (message Event에서 파싱)
  | 'message_updated' // 메시지 Edit (message Event에서 파싱)
  | 'message_deleted' // 메시지 Delete (message Event에서 파싱)
  | 'thread_message_created' // 스레드 메시지 Create (message Event에서 파싱)
  | 'thread_updated' // 스레드 업데이트 (message Event에서 파싱)
  | 'message_reaction_updated' // 리액션 업데이트
  | 'connection_established' // 연결 Settings됨
  | 'connection_lost' // 연결 끊어짐
  | 'connection_error' // 연결 오류
  | 'connection_failed' // 연결 Failed
  | 'authentication_failed' // Authentication Failed
  | 'channel_invitation' // 채널 초대
  | 'invitation_response' // 초대 Response
  | 'invitation_cancelled' // 초대 Cancel
  | 'user_joined_channel' // Used자 채널 입장
  | 'user_left_channel' // Used자 채널 퇴장
  | 'channel_updated' // 채널 업데이트
  | 'reaction_added' // 리액션 추가
  | 'reaction_removed' // 리액션 제거
  | 'user_online' // Used자 온라인
  | 'user_offline' // Used자 오프라인
  | 'presence_update'; // Update state

// API request/response types
export interface CreateChannelRequest {
  name: string;
  description?: string;
  type: 'public' | 'private';
  memberIds?: number[];
  settings?: Partial<ChannelSettings>;
}

export interface UpdateChannelRequest {
  name?: string;
  description?: string;
  settings?: Partial<ChannelSettings>;
}

export interface SendMessageRequest {
  content: string;
  channelId: number;
  type?: MessageType;
  replyToId?: number;
  threadId?: number;
  mentions?: number[];
  hashtags?: string[];
  attachments?: File[];
  metadata?: Partial<MessageMetadata>;
}

export interface UpdateMessageRequest {
  content: string;
  mentions?: number[];
  hashtags?: string[];
}

export interface GetMessagesRequest {
  channelId: number;
  page?: number;
  limit?: number;
  before?: string; // message ID or timestamp
  after?: string;
  search?: string;
}

export interface GetChannelsRequest {
  type?: 'public' | 'private' | 'direct';
  search?: string;
  page?: number;
  limit?: number;
}

// Chat state management types
export interface ChatState {
  channels: Channel[];
  currentChannelId: number | null;
  messages: Record<number, Message[]>; // channelId -> messages
  users: Record<number, User>; // userId -> user
  user: User | null; // current user
  typingUsers: Record<number, TypingIndicator[]>; // channelId -> typing users
  threadTypingUsers: Record<number, TypingIndicator[]>; // threadId -> typing users
  notifications: ChatNotification[];
  isConnected: boolean;
  isLoading: boolean;
  loadingStage: 'idle' | 'syncing' | 'connecting' | 'loading_channels' | 'complete';
  loadingStartTime: number | null; // 로딩 시작 시간
  pendingInvitationsCount: number; // 받은 초대 수
  error: string | null; // error message
}

export interface ChatContextType {
  state: ChatState;
  actions: {
    setCurrentChannel: (channelId: number | null) => void;
    sendMessage: (channelId: number, message: SendMessageRequest) => Promise<Message>;
    editMessage: (messageId: number, content: string) => Promise<Message>;
    deleteMessage: (messageId: number) => Promise<void>;
    createChannel: (channel: CreateChannelRequest) => Promise<Channel>;
    updateChannel: (channelId: number, updates: UpdateChannelRequest) => Promise<Channel>;
    joinChannel: (channelId: number) => Promise<void>;
    leaveChannel: (channelId: number) => Promise<void>;
    addReaction: (messageId: number, emoji: string) => Promise<void>;
    removeReaction: (messageId: number, emoji: string) => Promise<void>;
    markAsRead: (channelId: number, messageId?: number) => Promise<void>;
    startTyping: (channelId: number, threadId?: number) => void;
    stopTyping: (channelId: number, threadId?: number) => void;
    searchMessages: (query: string, channelId?: number) => Promise<Message[]>;
    loadMessages: (channelId: number, forceReload?: boolean) => Promise<void>;
    loadMoreMessages: (channelId: number) => Promise<void>;
    uploadFile: (file: File, channelId: number) => Promise<MessageAttachment>;
    inviteUser: (channelId: number, userId: number, message?: string) => Promise<void>;
    loadPendingInvitationsCount: () => Promise<void>;
    getThreadMessages: (threadId: number) => Promise<Message[]>;
    clearError: () => void;
  };
}

// Emoji and rich text types
export interface EmojiData {
  id: string;
  name: string;
  native: string;
  unified: string;
  keywords: string[];
  shortcodes: string[];
}

export interface RichTextElement {
  type: 'text' | 'emoji' | 'mention' | 'hashtag' | 'link';
  content: string;
  data?: any; // additional data for specific types
}

// Status types
export type UserStatus = 'online' | 'away' | 'busy' | 'offline' | 'invisible';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
