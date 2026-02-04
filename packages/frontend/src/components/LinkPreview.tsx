import React, { useState, useEffect } from 'react';
import { LinkPreviewData, linkPreviewService } from '../services/linkPreviewService';
import './LinkPreview.css';

interface LinkPreviewProps {
  url: string;
  className?: string;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url, className = '' }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!linkPreviewService.isPreviewableUrl(url)) {
        setLoading(false);
        setError(true);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        const previewData = await linkPreviewService.getPreview(url);

        if (previewData) {
          setPreview(previewData);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to load link preview:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className={`link-preview loading ${className}`} data-link-preview="loading">
        <div className="link-preview-skeleton">
          <div className="skeleton-image"></div>
          <div className="skeleton-content">
            <div className="skeleton-title"></div>
            <div className="skeleton-description"></div>
            <div className="skeleton-meta"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className={`link-preview error ${className}`} data-link-preview="error">
        <div className="link-preview-fallback">
          <div className="fallback-icon">🔗</div>
          <div className="fallback-content">
            <div className="fallback-url">{url}</div>
            <div className="fallback-message">링크 미리보기를 불러올 수 없습니다</div>
          </div>
        </div>
      </div>
    );
  }

  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDescription = (description: string) => {
    if (description.length > 150) {
      return description.substring(0, 150) + '...';
    }
    return description;
  };

  const isYouTubeUrl = (url: string): boolean => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/.test(url);
  };

  const getYouTubeEmbedUrl = (url: string): string | null => {
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
    );
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  const renderYouTubeEmbed = () => {
    const embedUrl = getYouTubeEmbedUrl(url);
    if (!embedUrl) return null;

    return (
      <div
        className="link-preview-youtube"
        style={{
          position: 'relative',
          paddingBottom: '56.25%',
          height: 0,
          overflow: 'hidden',
        }}
      >
        <iframe
          src={embedUrl}
          title={preview?.title || 'YouTube video'}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  };

  return (
    <div
      className={`link-preview ${className}`}
      onClick={isYouTubeUrl(url) ? undefined : handleClick}
      data-link-preview="loaded"
    >
      <div className="link-preview-card">
        {isYouTubeUrl(url) ? (
          renderYouTubeEmbed()
        ) : preview.image ? (
          <div className="link-preview-image">
            <img
              src={preview.image}
              alt={preview.title || 'Link preview'}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        ) : null}

        <div className="link-preview-content">
          <div className="link-preview-header">
            {preview.favicon && (
              <img
                src={preview.favicon}
                alt="Site favicon"
                className="link-preview-favicon"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
            <span className="link-preview-site-name">
              {preview.siteName || new URL(url).hostname}
            </span>
          </div>

          {preview.title && <h3 className="link-preview-title">{preview.title}</h3>}

          {preview.description && (
            <p className="link-preview-description">{formatDescription(preview.description)}</p>
          )}

          <div className="link-preview-meta">
            {preview.author && (
              <span className="link-preview-author">작성자: {preview.author}</span>
            )}

            {preview.readingTime && (
              <span className="link-preview-reading-time">읽기 시간: {preview.readingTime}</span>
            )}

            {preview.publishedTime && (
              <span className="link-preview-published-time">
                {linkPreviewService.formatPublishedTime(preview.publishedTime)}
              </span>
            )}
          </div>

          <div className="link-preview-url">
            {isYouTubeUrl(url) ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {url}
              </a>
            ) : (
              url
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface LinkPreviewListProps {
  urls: string[];
  className?: string;
}

export const LinkPreviewList: React.FC<LinkPreviewListProps> = ({ urls, className = '' }) => {
  const [previews, setPreviews] = useState<Map<string, LinkPreviewData | null>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreviews = async () => {
      if (urls.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const previewMap = await linkPreviewService.getMultiplePreviews(urls);
        setPreviews(previewMap);
      } catch (err) {
        console.error('Failed to load link previews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviews();
  }, [urls]);

  if (loading) {
    return (
      <div className={`link-preview-list loading ${className}`}>
        {urls.map((url, index) => (
          <LinkPreview key={`${url}-${index}`} url={url} />
        ))}
      </div>
    );
  }

  const validPreviews = Array.from(previews.entries()).filter(([_, preview]) => preview !== null);

  if (validPreviews.length === 0) {
    return null;
  }

  return (
    <div className={`link-preview-list ${className}`}>
      {validPreviews.map(([url, preview], index) => (
        <LinkPreview key={`${url}-${index}`} url={url} />
      ))}
    </div>
  );
};
