// Chat related types and interfaces

export interface User {
  id: number;
  username: string;
  name?: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
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
  | 'message_created'
  | 'message_updated'
  | 'message_deleted'
  | 'user_typing'
  | 'user_stop_typing'
  | 'user_joined_channel'
  | 'user_left_channel'
  | 'channel_updated'
  | 'reaction_added'
  | 'reaction_removed'
  | 'user_online'
  | 'user_offline'
  | 'channel_invitation'
  | 'invitation_response'
  | 'invitation_cancelled'
  | 'connection_established'
  | 'connection_lost'
  | 'connection_error'
  | 'authentication_failed'
  | 'message'
  | 'user_joined'
  | 'user_left'
  | 'typing'
  | 'stop_typing'
  | 'presence_update'
  | 'channel_joined'
  | 'channel_left'
  | 'error';

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
  type?: MessageType;
  replyToId?: number;
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
  notifications: ChatNotification[];
  isConnected: boolean;
  isLoading: boolean;
  pendingInvitationsCount: number; // 받은 초대 수
}

export interface ChatContextType {
  state: ChatState;
  actions: {
    setCurrentChannel: (channelId: number | null) => void;
    sendMessage: (channelId: number, message: SendMessageRequest) => Promise<void>;
    editMessage: (messageId: number, content: string) => Promise<void>;
    deleteMessage: (messageId: number) => Promise<void>;
    createChannel: (channel: CreateChannelRequest) => Promise<Channel>;
    updateChannel: (channelId: number, updates: UpdateChannelRequest) => Promise<void>;
    joinChannel: (channelId: number) => Promise<void>;
    leaveChannel: (channelId: number) => Promise<void>;
    addReaction: (messageId: number, emoji: string) => Promise<void>;
    removeReaction: (messageId: number, emoji: string) => Promise<void>;
    markAsRead: (channelId: number, messageId?: number) => Promise<void>;
    startTyping: (channelId: number) => void;
    stopTyping: (channelId: number) => void;
    searchMessages: (query: string, channelId?: number) => Promise<Message[]>;
    loadMessages: (channelId: number) => Promise<void>;
    loadMoreMessages: (channelId: number) => Promise<void>;
    uploadFile: (file: File, channelId: number) => Promise<MessageAttachment>;
    inviteUser: (channelId: number, userId: number, message?: string) => Promise<void>;
    loadPendingInvitationsCount: () => Promise<void>;
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
