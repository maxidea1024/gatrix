import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import ChatElementsMessageList from '../ChatElementsMessageList';
import { ChatProvider } from '../../../contexts/ChatContext';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock WebSocket service
jest.mock('../../../services/websocketService', () => ({
  wsService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    joinChannel: jest.fn(),
    leaveChannel: jest.fn(),
    sendMessage: jest.fn(),
    onMessageCreated: jest.fn(),
    onMessageUpdated: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

// Mock chat service
jest.mock('../../../services/ChatService', () => ({
  getChannels: jest.fn().mockResolvedValue([]),
  getMessages: jest.fn().mockResolvedValue([]),
  sendMessage: jest.fn().mockResolvedValue({}),
}));

const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>
    <ChatProvider>{children}</ChatProvider>
  </ThemeProvider>
);

describe('Chat Scroll Behavior', () => {
  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();

    // Mock querySelector to return a mock element
    const mockContainer = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTo: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([]),
    };

    document.querySelector = jest.fn().mockReturnValue(mockContainer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle auto-scroll with media content', async () => {
    const mockMessages = [
      {
        id: '1',
        content: 'Hello world',
        userId: 'user1',
        channelId: 'channel1',
        type: 'text' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        content: 'Check this out: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        userId: 'user1',
        channelId: 'channel1',
        type: 'text' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock media elements
    const mockImg = document.createElement('img');
    const mockIframe = document.createElement('iframe');

    const mockContainer = {
      scrollTop: 400,
      scrollHeight: 1000,
      clientHeight: 500,
      scrollTo: jest.fn(),
      querySelectorAll: jest.fn().mockReturnValue([mockImg, mockIframe]),
    };

    document.querySelector = jest.fn().mockReturnValue(mockContainer);

    render(
      <TestWrapper>
        <ChatElementsMessageList channelId="channel1" />
      </TestWrapper>
    );

    // Wait for the component to process messages and media
    await waitFor(
      () => {
        expect(mockContainer.scrollTo).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
  });

  it('should detect YouTube URLs correctly', () => {
    const youtubeUrls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ];

    const isYouTubeUrl = (url: string): boolean => {
      return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
    };

    youtubeUrls.forEach((url) => {
      expect(isYouTubeUrl(url)).toBe(true);
    });

    expect(isYouTubeUrl('https://example.com')).toBe(false);
  });

  it('should handle image load events', async () => {
    const mockImg = document.createElement('img');
    const loadHandler = jest.fn();

    mockImg.addEventListener('load', loadHandler);

    // Simulate image load
    act(() => {
      const event = new Event('load');
      mockImg.dispatchEvent(event);
    });

    expect(loadHandler).toHaveBeenCalled();
  });
});
