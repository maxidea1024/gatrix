import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Popover,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Typography,
  Divider,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme, Categories } from 'emoji-picker-react';

// Register custom video blot for Quill
const BlockEmbed = Quill.import('blots/block/embed') as any;

class VideoBlot extends BlockEmbed {
  static blotName = 'video';
  static tagName = 'div';
  static className = 'video-wrapper';

  static create(value: any) {
    const node = super.create(value) as HTMLDivElement;
    // Set contenteditable to false to prevent editing the iframe
    // But keep the wrapper deletable by Quill
    node.setAttribute('contenteditable', 'false');
    // Add data attribute to help with selection and deletion
    node.setAttribute('data-video-embed', 'true');

    const iframe = document.createElement('iframe');

    if (typeof value === 'string') {
      iframe.setAttribute('src', value);
    } else {
      iframe.setAttribute('src', value.src);
      if (value.width) iframe.style.width = value.width;
      if (value.height) iframe.style.height = value.height;
      if (value.align) {
        if (value.align === 'center') {
          iframe.style.display = 'block';
          iframe.style.marginLeft = 'auto';
          iframe.style.marginRight = 'auto';
        } else if (value.align === 'left') {
          iframe.style.float = 'left';
          iframe.style.marginRight = '10px';
          iframe.style.marginBottom = '10px';
        } else if (value.align === 'right') {
          iframe.style.float = 'right';
          iframe.style.marginLeft = '10px';
          iframe.style.marginBottom = '10px';
        }
      }
    }

    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.style.border = 'none';

    node.style.margin = '10px 0';
    node.appendChild(iframe);

    return node;
  }

  static value(node: HTMLDivElement) {
    const iframe = node.querySelector('iframe');
    if (!iframe) return { src: '' };

    return {
      src: iframe.getAttribute('src'),
      width: iframe.style.width,
      height: iframe.style.height,
      align: iframe.style.float || (iframe.style.display === 'block' && iframe.style.marginLeft === 'auto' ? 'center' : 'left'),
    };
  }

  // Override deleteAt to ensure proper deletion
  deleteAt(index: number, length: number) {
    super.deleteAt(index, length);
  }
}

Quill.register(VideoBlot);
import {
  EmojiEmotions as EmojiIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  Link as LinkIcon,
  FormatClear as ClearIcon,
  Image as ImageIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  VideoLibrary as VideoIcon,
} from '@mui/icons-material';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  readOnly = false,
  minHeight = 200,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const quillRef = useRef<ReactQuill>(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<{ mouseX: number; mouseY: number; imgElement: HTMLImageElement } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageWidth, setImageWidth] = useState<'original' | '25' | '50' | '75' | '100' | 'custom'>('100');
  const [imageCustomWidth, setImageCustomWidth] = useState('');
  const [imageAlign, setImageAlign] = useState<'left' | 'center' | 'right'>('center');
  const [imageBorder, setImageBorder] = useState<'none' | 'thin' | 'medium' | 'thick'>('none');
  const [imageBorderColor, setImageBorderColor] = useState('#cccccc');
  const [imageAltText, setImageAltText] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState(true);
  const [imageShadow, setImageShadow] = useState<'none' | 'small' | 'medium' | 'large'>('none');
  const [imageShadowColor, setImageShadowColor] = useState('rgba(0, 0, 0, 0.3)');
  const [imageShadowDirection, setImageShadowDirection] = useState<'all' | 'top' | 'bottom' | 'left' | 'right'>('all');
  const [imageBorderRadius, setImageBorderRadius] = useState<'none' | 'small' | 'medium' | 'large' | 'custom'>('none');
  const [imageCustomBorderRadius, setImageCustomBorderRadius] = useState('');
  const [advancedOptionsExpanded, setAdvancedOptionsExpanded] = useState(() => {
    const saved = localStorage.getItem('richTextEditor.advancedOptionsExpanded');
    return saved !== null ? saved === 'true' : false; // Default to collapsed
  });
  const [imageUrlValid, setImageUrlValid] = useState<boolean | null>(null);
  const [imageUrlValidating, setImageUrlValidating] = useState(false);
  const [imageOriginalSize, setImageOriginalSize] = useState<{ width: number; height: number } | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoWidth, setVideoWidth] = useState<'25' | '50' | '75' | '100' | 'custom'>('100');
  const [videoCustomWidth, setVideoCustomWidth] = useState('');
  const [videoAlign, setVideoAlign] = useState<'left' | 'center' | 'right'>('center');
  const [videoAutoplay, setVideoAutoplay] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const savedSelectionRef = useRef<{ index: number; length: number } | null>(null);
  const imageValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save advanced options state to localStorage
  const handleAdvancedOptionsChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    setAdvancedOptionsExpanded(isExpanded);
    localStorage.setItem('richTextEditor.advancedOptionsExpanded', String(isExpanded));
  };

  // Validate image URL
  const validateImageUrl = (url: string) => {
    // Clear previous timeout
    if (imageValidationTimeoutRef.current) {
      clearTimeout(imageValidationTimeoutRef.current);
    }

    if (!url) {
      setImageUrlValid(null);
      setImageUrlValidating(false);
      setImageOriginalSize(null);
      return;
    }

    // Basic URL format check
    try {
      new URL(url);
    } catch {
      setImageUrlValid(false);
      setImageUrlValidating(false);
      setImageOriginalSize(null);
      return;
    }

    // Debounce image loading check
    setImageUrlValidating(true);
    imageValidationTimeoutRef.current = setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        setImageUrlValid(true);
        setImageUrlValidating(false);
        setImageOriginalSize({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        setImageUrlValid(false);
        setImageUrlValidating(false);
        setImageOriginalSize(null);
      };
      img.src = url;
    }, 500); // 500ms debounce
  };

  // Validate image URL when it changes
  useEffect(() => {
    validateImageUrl(imageUrl);
    return () => {
      if (imageValidationTimeoutRef.current) {
        clearTimeout(imageValidationTimeoutRef.current);
      }
    };
  }, [imageUrl]);

  // Save cursor position continuously
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();

      const handleSelectionChange = () => {
        const selection = editor.getSelection();
        if (selection) {
          savedSelectionRef.current = selection;
        }
      };

      // Listen to selection changes
      editor.on('selection-change', handleSelectionChange);

      return () => {
        editor.off('selection-change', handleSelectionChange);
      };
    }
  }, []);

  // Handle image right-click context menu
  useEffect(() => {
    if (quillRef.current && !readOnly) {
      const editor = quillRef.current.getEditor();
      const editorRoot = editor.root;

      const handleImageContextMenu = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG') {
          e.preventDefault();
          e.stopPropagation();
          setImageContextMenu({
            mouseX: e.clientX,
            mouseY: e.clientY,
            imgElement: target as HTMLImageElement,
          });
        }
      };

      // Use capture phase to prevent default browser context menu
      editorRoot.addEventListener('contextmenu', handleImageContextMenu, true);

      return () => {
        editorRoot.removeEventListener('contextmenu', handleImageContextMenu, true);
      };
    }
  }, [readOnly]);

  // Validate video URL and update preview
  useEffect(() => {
    // Clear previous timeout
    if (videoValidationTimeoutRef.current) {
      clearTimeout(videoValidationTimeoutRef.current);
    }

    if (!videoUrl) {
      setVideoPreviewUrl(null);
      return;
    }

    // Debounce validation
    videoValidationTimeoutRef.current = setTimeout(() => {
      const videoInfo = getVideoEmbedUrl(videoUrl);
      if (videoInfo) {
        setVideoPreviewUrl(videoInfo.embedUrl);
      } else {
        setVideoPreviewUrl(null);
      }
    }, 500);

    return () => {
      if (videoValidationTimeoutRef.current) {
        clearTimeout(videoValidationTimeoutRef.current);
      }
    };
  }, [videoUrl]);

  // Extract video embed URL from YouTube or Bilibili URL
  const getVideoEmbedUrl = (url: string, autoplay: boolean = false): { embedUrl: string; platform: 'youtube' | 'bilibili' | null } | null => {
    try {
      const urlObj = new URL(url);

      // YouTube
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        let videoId = '';

        if (urlObj.hostname.includes('youtu.be')) {
          // Short URL: https://youtu.be/VIDEO_ID
          videoId = urlObj.pathname.slice(1);
        } else if (urlObj.pathname.includes('/embed/')) {
          // Already embed URL
          videoId = urlObj.pathname.split('/embed/')[1];
        } else {
          // Regular URL: https://www.youtube.com/watch?v=VIDEO_ID
          videoId = urlObj.searchParams.get('v') || '';
        }

        if (videoId) {
          // Add autoplay parameter (0 = no autoplay, 1 = autoplay)
          const autoplayParam = autoplay ? '1' : '0';
          return {
            embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=${autoplayParam}`,
            platform: 'youtube',
          };
        }
      }

      // Bilibili
      if (urlObj.hostname.includes('bilibili.com')) {
        let bvid = '';

        // Extract BV ID from URL
        const pathMatch = urlObj.pathname.match(/\/(BV[\w]+)/);
        if (pathMatch) {
          bvid = pathMatch[1];
        }

        if (bvid) {
          // Add autoplay parameter (0 = no autoplay, 1 = autoplay)
          const autoplayParam = autoplay ? '1' : '0';
          return {
            embedUrl: `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=${autoplayParam}`,
            platform: 'bilibili',
          };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Handle emoji picker
  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Save current selection before opening picker
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = editor.getSelection();
      if (selection) {
        savedSelectionRef.current = selection;
      }
    }
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();

      // Restore focus first
      editor.focus();

      // Use saved selection
      const selection = savedSelectionRef.current;
      const position = selection ? selection.index : editor.getLength();

      // Insert emoji at the saved position
      editor.insertText(position, emojiData.emoji);

      // Move cursor after the emoji
      editor.setSelection(position + emojiData.emoji.length, 0);
    }
    handleEmojiClose();
  };

  const emojiOpen = Boolean(emojiAnchorEl);

  // Handle context menu
  const handleContextMenu = (event: React.MouseEvent) => {
    if (readOnly) return;
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX - 2, mouseY: event.clientY - 4 }
        : null
    );
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const insertEmoji = () => {
    handleContextMenuClose();
    // Trigger emoji picker
    const emojiButton = document.querySelector('[aria-label="Insert emoji"]') as HTMLButtonElement;
    if (emojiButton) {
      emojiButton.click();
    }
  };

  const insertLink = () => {
    handleContextMenuClose();

    // Get selected text if any
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;

      if (selection && selection.length > 0) {
        const selectedText = editor.getText(selection.index, selection.length);
        setLinkText(selectedText);
      } else {
        setLinkText('');
      }
    }

    setLinkUrl('');
    setLinkDialogOpen(true);
  };

  const handleLinkDialogClose = () => {
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleLinkInsert = () => {
    if (quillRef.current && linkUrl) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;

      if (selection && selection.length > 0) {
        // Apply link to selected text
        editor.formatText(selection.index, selection.length, 'link', linkUrl);
      } else {
        // Insert new link with text
        const position = selection ? selection.index : editor.getLength();
        const textToInsert = linkText || linkUrl;
        editor.insertText(position, textToInsert, 'link', linkUrl);
        editor.setSelection(position + textToInsert.length, 0);
      }

      editor.focus();
    }

    handleLinkDialogClose();
  };

  // Video insert handlers
  const insertVideo = () => {
    handleContextMenuClose();
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = editor.getSelection();
      savedSelectionRef.current = selection;
    }
    setVideoDialogOpen(true);
  };

  const handleVideoDialogClose = () => {
    setVideoDialogOpen(false);
    setVideoUrl('');
    setVideoWidth('100');
    setVideoCustomWidth('');
    setVideoAlign('center');
    setVideoAutoplay(false);
    setVideoPreviewUrl(null);

    // Return focus to editor after dialog closes to prevent aria-hidden warning
    setTimeout(() => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        editor.focus();
      }
    }, 100);
  };

  const handleVideoInsert = () => {
    if (quillRef.current && videoUrl) {
      const videoInfo = getVideoEmbedUrl(videoUrl, videoAutoplay);

      if (!videoInfo) {
        alert(t('richTextEditor.invalidVideoUrl', 'Invalid video URL. Please use YouTube or Bilibili URL.'));
        return;
      }

      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      const position = selection ? selection.index : editor.getLength();

      // Calculate width
      let width = '100%';
      if (videoWidth === 'custom' && videoCustomWidth) {
        width = `${videoCustomWidth}px`;
      } else if (videoWidth !== '100') {
        width = `${videoWidth}%`;
      }

      // Calculate height (16:9 aspect ratio)
      const widthValue = videoWidth === 'custom' && videoCustomWidth ? parseInt(videoCustomWidth) : 640;
      const height = Math.round(widthValue * 9 / 16);

      // Build iframe HTML
      let iframeStyle = `width: ${width}; height: ${height}px; border: none;`;

      // Alignment
      if (videoAlign === 'center') {
        iframeStyle += ' display: block; margin-left: auto; margin-right: auto;';
      } else if (videoAlign === 'left') {
        iframeStyle += ' float: left; margin-right: 10px; margin-bottom: 10px;';
      } else if (videoAlign === 'right') {
        iframeStyle += ' float: right; margin-left: 10px; margin-bottom: 10px;';
      }

      // Insert a newline before video if not at the start
      if (position > 0) {
        const previousChar = editor.getText(position - 1, 1);
        if (previousChar !== '\n') {
          editor.insertText(position, '\n');
          editor.insertEmbed(position + 1, 'video', {
            src: videoInfo.embedUrl,
            width: width,
            height: `${height}px`,
            align: videoAlign,
          });
          // Insert two newlines after video for better editing
          editor.insertText(position + 2, '\n\n');
          editor.setSelection(position + 3, 0);
        } else {
          editor.insertEmbed(position, 'video', {
            src: videoInfo.embedUrl,
            width: width,
            height: `${height}px`,
            align: videoAlign,
          });
          // Insert two newlines after video for better editing
          editor.insertText(position + 1, '\n\n');
          editor.setSelection(position + 2, 0);
        }
      } else {
        editor.insertEmbed(position, 'video', {
          src: videoInfo.embedUrl,
          width: width,
          height: `${height}px`,
          align: videoAlign,
        });
        // Insert two newlines after video for better editing
        editor.insertText(position + 1, '\n\n');
        editor.setSelection(position + 2, 0);
      }

      editor.focus();
    }

    handleVideoDialogClose();
  };

  const formatBold = () => {
    handleContextMenuClose();
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        const format = editor.getFormat(selection.index, selection.length);
        editor.formatText(selection.index, selection.length, 'bold', !format.bold);
        editor.focus();
      }
    }
  };

  const formatItalic = () => {
    handleContextMenuClose();
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        const format = editor.getFormat(selection.index, selection.length);
        editor.formatText(selection.index, selection.length, 'italic', !format.italic);
        editor.focus();
      }
    }
  };

  const formatUnderline = () => {
    handleContextMenuClose();
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        const format = editor.getFormat(selection.index, selection.length);
        editor.formatText(selection.index, selection.length, 'underline', !format.underline);
        editor.focus();
      }
    }
  };

  const clearFormatting = () => {
    handleContextMenuClose();
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        editor.removeFormat(selection.index, selection.length);
        editor.focus();
      }
    }
  };

  // Handle image insertion
  const insertImage = () => {
    handleContextMenuClose();
    // Save current cursor position before opening dialog
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = editor.getSelection();
      savedSelectionRef.current = selection;
    }
    setIsEditingImage(false);
    setImageUrl('');
    setImageWidth('100');
    setImageCustomWidth('');
    setImageAlign('center');
    setImageBorder('none');
    setImageBorderColor('#cccccc');
    setImageAltText('');
    setImageAspectRatio(true);
    setImageShadow('none');
    setImageShadowColor('rgba(0, 0, 0, 0.3)');
    setImageShadowDirection('all');
    setImageBorderRadius('none');
    setImageCustomBorderRadius('');
    setImageUrlValid(null);
    setImageUrlValidating(false);
    setImageOriginalSize(null);
    setImageDialogOpen(true);
  };

  // Handle image editing
  const handleEditImage = () => {
    if (!imageContextMenu) return;

    const imgElement = imageContextMenu.imgElement;
    const metadataStr = imgElement.getAttribute('data-image-metadata');

    // Load image data
    setImageUrl(imgElement.src);
    setImageAltText(imgElement.alt || '');

    // Load metadata if available
    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr);
        setImageWidth(metadata.width || '100');
        setImageCustomWidth(metadata.customWidth || '');
        setImageAlign(metadata.align || 'center');
        setImageBorder(metadata.border || 'none');
        setImageBorderColor(metadata.borderColor || '#cccccc');
        setImageAspectRatio(metadata.aspectRatio !== undefined ? metadata.aspectRatio : true);
        setImageShadow(metadata.shadow || 'none');
        setImageShadowColor(metadata.shadowColor || 'rgba(0, 0, 0, 0.3)');
        setImageShadowDirection(metadata.shadowDirection || 'all');
        setImageBorderRadius(metadata.borderRadius || 'none');
        setImageCustomBorderRadius(metadata.customBorderRadius || '');
      } catch (e) {
        // If metadata parsing fails, use defaults
        console.error('Failed to parse image metadata:', e);
      }
    }

    setIsEditingImage(true);
    setImageDialogOpen(true);
    setImageContextMenu(null);
  };

  // Handle image copy
  const handleCopyImage = () => {
    if (!imageContextMenu || !quillRef.current) return;

    const imgElement = imageContextMenu.imgElement;
    const editor = quillRef.current.getEditor();

    // Get the image's metadata
    const metadataStr = imgElement.getAttribute('data-image-metadata');
    const src = imgElement.src;
    const alt = imgElement.alt || '';
    const style = imgElement.getAttribute('style') || '';

    // Store the copied image data in a temporary state or use clipboard API
    // We'll insert it at the current cursor position
    const selection = editor.getSelection();
    const position = selection ? selection.index : editor.getLength();

    // Insert a newline before image if not at the start
    if (position > 0) {
      const previousChar = editor.getText(position - 1, 1);
      if (previousChar !== '\n') {
        editor.insertText(position, '\n');
        editor.insertEmbed(position + 1, 'image', src);
        editor.insertText(position + 2, '\n');
        editor.setSelection(position + 3, 0);
      } else {
        editor.insertEmbed(position, 'image', src);
        editor.insertText(position + 1, '\n');
        editor.setSelection(position + 2, 0);
      }
    } else {
      editor.insertEmbed(position, 'image', src);
      editor.insertText(position + 1, '\n');
      editor.setSelection(position + 2, 0);
    }

    // Apply the same style and metadata to the newly inserted image
    setTimeout(() => {
      const imgElements = editor.root.querySelectorAll('img');
      const newImgElement = Array.from(imgElements).find(
        (img) => (img as HTMLImageElement).src === src && img !== imgElement
      ) as HTMLImageElement | undefined;

      if (newImgElement) {
        newImgElement.setAttribute('alt', alt);
        if (style) {
          newImgElement.setAttribute('style', style);
        }
        if (metadataStr) {
          newImgElement.setAttribute('data-image-metadata', metadataStr);
        }
      }
    }, 100);

    setImageContextMenu(null);
  };

  // Handle image delete
  const handleDeleteImage = () => {
    if (!imageContextMenu || !quillRef.current) return;

    const editor = quillRef.current.getEditor();
    const imgElement = imageContextMenu.imgElement;

    // Find the image in the editor and delete it
    const delta = editor.getContents();
    let index = 0;

    delta.ops?.forEach((op, i) => {
      if (op.insert && typeof op.insert === 'object' && 'image' in op.insert) {
        const img = op.insert as { image: string };
        if (img.image === imgElement.src) {
          // Delete the image
          editor.deleteText(index, 1);
        }
      }
      if (typeof op.insert === 'string') {
        index += op.insert.length;
      } else {
        index += 1;
      }
    });

    setImageContextMenu(null);
  };

  const handleImageDialogClose = () => {
    setImageDialogOpen(false);
    setIsEditingImage(false);
    setImageUrl('');
    setImageWidth('100');
    setImageCustomWidth('');
    setImageAlign('center');
    setImageBorder('none');
    setImageBorderColor('#cccccc');
    setImageAltText('');
    setImageAspectRatio(true);
    setImageShadow('none');
    setImageShadowColor('rgba(0, 0, 0, 0.3)');
    setImageShadowDirection('all');
    setImageBorderRadius('none');
    setImageCustomBorderRadius('');
    setImageUrlValid(null);
    setImageUrlValidating(false);
    setImageOriginalSize(null);
  };

  // Apply styles to image element
  const applyImageStyles = (imgElement: HTMLImageElement) => {
    // Set alt text
    if (imageAltText) {
      imgElement.setAttribute('alt', imageAltText);
    }

    // Store image metadata for editing
    const metadata = {
      width: imageWidth,
      customWidth: imageCustomWidth,
      align: imageAlign,
      border: imageBorder,
      borderColor: imageBorderColor,
      altText: imageAltText,
      aspectRatio: imageAspectRatio,
      shadow: imageShadow,
      shadowColor: imageShadowColor,
      shadowDirection: imageShadowDirection,
      borderRadius: imageBorderRadius,
      customBorderRadius: imageCustomBorderRadius,
    };
    imgElement.setAttribute('data-image-metadata', JSON.stringify(metadata));

    // Build image style
    const styles: string[] = [];

    // Width
    if (imageWidth === 'original') {
      styles.push('max-width: 100%');
    } else if (imageWidth === 'custom' && imageCustomWidth) {
      styles.push(`width: ${imageCustomWidth}px`);
      styles.push('max-width: 100%');
    } else {
      styles.push(`width: ${imageWidth}%`);
    }

    // Height - aspect ratio
    if (imageAspectRatio) {
      styles.push('height: auto');
    }

    // Alignment
    if (imageAlign === 'center') {
      styles.push('display: block');
      styles.push('margin-left: auto');
      styles.push('margin-right: auto');
    } else if (imageAlign === 'left') {
      styles.push('float: left');
      styles.push('margin-right: 10px');
      styles.push('margin-bottom: 10px');
    } else if (imageAlign === 'right') {
      styles.push('float: right');
      styles.push('margin-left: 10px');
      styles.push('margin-bottom: 10px');
    }

    // Border
    if (imageBorder !== 'none') {
      const borderWidth = imageBorder === 'thin' ? '1px' : imageBorder === 'medium' ? '2px' : '3px';
      styles.push(`border: ${borderWidth} solid ${imageBorderColor}`);
    }

    // Shadow
    if (imageShadow !== 'none') {
      const blur =
        imageShadow === 'small' ? '4px' :
        imageShadow === 'medium' ? '8px' :
        '16px';

      let shadowValue = '';
      if (imageShadowDirection === 'all') {
        shadowValue = `0 0 ${blur}`;
      } else if (imageShadowDirection === 'top') {
        shadowValue = `0 -${blur.replace('px', '') === '4' ? '2' : blur.replace('px', '') === '8' ? '4' : '8'}px ${blur}`;
      } else if (imageShadowDirection === 'bottom') {
        shadowValue = `0 ${blur.replace('px', '') === '4' ? '2' : blur.replace('px', '') === '8' ? '4' : '8'}px ${blur}`;
      } else if (imageShadowDirection === 'left') {
        shadowValue = `-${blur.replace('px', '') === '4' ? '2' : blur.replace('px', '') === '8' ? '4' : '8'}px 0 ${blur}`;
      } else if (imageShadowDirection === 'right') {
        shadowValue = `${blur.replace('px', '') === '4' ? '2' : blur.replace('px', '') === '8' ? '4' : '8'}px 0 ${blur}`;
      }

      styles.push(`box-shadow: ${shadowValue} ${imageShadowColor}`);
    }

    // Border Radius
    if (imageBorderRadius !== 'none') {
      let radiusValue = '';
      if (imageBorderRadius === 'small') {
        radiusValue = '4px';
      } else if (imageBorderRadius === 'medium') {
        radiusValue = '8px';
      } else if (imageBorderRadius === 'large') {
        radiusValue = '16px';
      } else if (imageBorderRadius === 'custom' && imageCustomBorderRadius) {
        radiusValue = imageCustomBorderRadius + 'px';
      }
      if (radiusValue) {
        styles.push(`border-radius: ${radiusValue}`);
      }
    }

    // Apply styles
    imgElement.setAttribute('style', styles.join('; '));
  };

  const handleImageInsert = () => {
    if (quillRef.current && imageUrl) {
      const editor = quillRef.current.getEditor();

      if (isEditingImage) {
        // Editing mode: find and update the existing image
        setTimeout(() => {
          const imgElements = editor.root.querySelectorAll('img');
          const imgElement = Array.from(imgElements).find(
            (img) => (img as HTMLImageElement).src === imageUrl
          ) as HTMLImageElement | undefined;

          if (imgElement) {
            applyImageStyles(imgElement);
          }
        }, 100);
      } else {
        // Insert mode: insert new image
        const selection = savedSelectionRef.current;
        const position = selection ? selection.index : editor.getLength();

        // Insert a newline before image if not at the start
        if (position > 0) {
          const previousChar = editor.getText(position - 1, 1);
          if (previousChar !== '\n') {
            editor.insertText(position, '\n');
            editor.insertEmbed(position + 1, 'image', imageUrl);
            // Insert one newline after image for easy editing
            editor.insertText(position + 2, '\n');
            // Set cursor position after the newline
            editor.setSelection(position + 3, 0);
          } else {
            editor.insertEmbed(position, 'image', imageUrl);
            // Insert one newline after image
            editor.insertText(position + 1, '\n');
            editor.setSelection(position + 2, 0);
          }
        } else {
          // At the start of document
          editor.insertEmbed(position, 'image', imageUrl);
          // Insert one newline after image
          editor.insertText(position + 1, '\n');
          editor.setSelection(position + 2, 0);
        }

        // Apply style to the inserted image using setTimeout to ensure DOM is updated
        setTimeout(() => {
          const imgElements = editor.root.querySelectorAll('img');
          const imgElement = Array.from(imgElements).find(
            (img) => (img as HTMLImageElement).src === imageUrl
          ) as HTMLImageElement | undefined;

          if (imgElement) {
            applyImageStyles(imgElement);
          }
        }, 100);

        editor.focus();
      }
    }

    handleImageDialogClose();
  };

  // Image handler for toolbar
  const imageHandler = () => {
    insertImage();
  };

  // Quill modules configuration
  const modules = useMemo(
    () => ({
      toolbar: readOnly
        ? false
        : {
            container: [
              [{ header: [1, 2, 3, false] }],
              [{ size: ['small', false, 'large', 'huge'] }], // Font size selector
              ['bold', 'italic', 'underline', 'strike'],
              [{ color: [] }, { background: [] }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ align: [] }], // Text alignment
              ['link', 'image'],
              ['clean'],
            ],
            handlers: {
              image: imageHandler,
            },
          },
      clipboard: {
        matchVisual: false,
      },
      keyboard: {
        bindings: {
          // Handle delete key for custom embeds (video, image)
          'delete': {
            key: 'Delete',
            handler: function(this: any, range: any) {
              const editor = this.quill;
              if (range.length > 0) {
                // If there's a selection, delete it
                editor.deleteText(range.index, range.length, 'user');
                return false; // Prevent default
              }
              return true; // Allow default behavior for single character delete
            }
          },
          // Handle backspace key for custom embeds
          'backspace': {
            key: 'Backspace',
            handler: function(this: any, range: any) {
              const editor = this.quill;
              if (range.length > 0) {
                // If there's a selection, delete it
                editor.deleteText(range.index, range.length, 'user');
                return false; // Prevent default
              }
              return true; // Allow default behavior for single character backspace
            }
          }
        }
      }
    }),
    [readOnly]
  );

  // Quill formats
  const formats = [
    'header',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'color',
    'background',
    'align',
    'link',
    'image',
    'video',
  ];

  // Add tooltips to toolbar buttons
  useEffect(() => {
    if (!quillRef.current || readOnly) return;

    const toolbar = quillRef.current.getEditor().getModule('toolbar');
    if (!toolbar || !toolbar.container) return;

    const container = toolbar.container as HTMLElement;

    // Tooltip mapping
    const tooltips: { [key: string]: string } = {
      '.ql-bold': t('richTextEditor.bold'),
      '.ql-italic': t('richTextEditor.italic'),
      '.ql-underline': t('richTextEditor.underline'),
      '.ql-strike': t('richTextEditor.strike'),
      '.ql-header[value="1"]': t('richTextEditor.header1'),
      '.ql-header[value="2"]': t('richTextEditor.header2'),
      '.ql-header[value="3"]': t('richTextEditor.header3'),
      '.ql-size': t('richTextEditor.size', 'Size'),
      '.ql-list[value="ordered"]': t('richTextEditor.orderedList'),
      '.ql-list[value="bullet"]': t('richTextEditor.bulletList'),
      '.ql-color': t('richTextEditor.textColor'),
      '.ql-background': t('richTextEditor.backgroundColor'),
      '.ql-align': t('richTextEditor.align', 'Align'),
      '.ql-link': t('richTextEditor.link'),
      '.ql-image': t('richTextEditor.image'),
      '.ql-clean': t('richTextEditor.clean'),
    };

    // Apply tooltips
    Object.entries(tooltips).forEach(([selector, tooltip]) => {
      const button = container.querySelector(selector);
      if (button) {
        button.setAttribute('title', tooltip);
      }
    });

    // Also handle header dropdown
    const headerPicker = container.querySelector('.ql-header .ql-picker-label');
    if (headerPicker) {
      headerPicker.setAttribute('title', t('richTextEditor.header'));
    }
  }, [t, readOnly]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper
        variant="outlined"
        sx={{
          overflow: 'visible', // Changed from 'hidden' to allow tooltip to show
          borderRadius: 2,
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
          '&:hover': {
            borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          },
          '&:focus-within': {
            borderColor: 'primary.main',
            borderWidth: 2,
          },
          '& .quill': {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
          '& .ql-toolbar': {
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          },
        '& .ql-container': {
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          fontSize: '14px',
          fontFamily: theme.typography.fontFamily,
          minHeight: `${minHeight}px`,
          overflow: 'visible', // Allow tooltip to overflow
        },
        '& .ql-editor': {
          minHeight: `${minHeight}px`,
          color: theme.palette.text.primary,
          '&.ql-blank::before': {
            color: theme.palette.text.secondary,
            fontStyle: 'normal',
          },
          // Image styling
          '& img': {
            maxWidth: '100%',
            height: 'auto',
            display: 'inline-block',
            verticalAlign: 'middle',
          },
        },
        '& .ql-stroke': {
          stroke: theme.palette.text.primary,
        },
        '& .ql-fill': {
          fill: theme.palette.text.primary,
        },
        '& .ql-picker-label': {
          color: theme.palette.text.primary,
        },
        '& .ql-picker-options': {
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        },
        '& .ql-toolbar button:hover, & .ql-toolbar button:focus': {
          color: theme.palette.primary.main,
          '& .ql-stroke': {
            stroke: theme.palette.primary.main,
          },
          '& .ql-fill': {
            fill: theme.palette.primary.main,
          },
        },
        '& .ql-toolbar button.ql-active': {
          color: theme.palette.primary.main,
          '& .ql-stroke': {
            stroke: theme.palette.primary.main,
          },
          '& .ql-fill': {
            fill: theme.palette.primary.main,
          },
        },
        // Link tooltip positioning
        '& .ql-tooltip': {
          position: 'absolute',
          zIndex: 9999,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[4],
          color: theme.palette.text.primary,
          padding: '8px 12px',
          borderRadius: '4px',
          left: '0 !important', // Override default positioning
          transform: 'translateY(10px)', // Position below the selection
          '& input[type="text"]': {
            backgroundColor: theme.palette.background.default,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            padding: '6px 8px',
            borderRadius: '4px',
            '&:focus': {
              outline: 'none',
              borderColor: theme.palette.primary.main,
            },
          },
          '& a.ql-action::after': {
            content: '"Edit"',
            color: theme.palette.primary.main,
          },
          '& a.ql-remove::before': {
            content: '"Remove"',
            color: theme.palette.error.main,
          },
        },
        '& .ql-tooltip.ql-editing': {
          left: '0 !important',
        },
      }}
    >
        <Box onContextMenu={handleContextMenu}>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value}
            onChange={onChange}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
            readOnly={readOnly}
          />
        </Box>
      </Paper>

      {/* Emoji Button - Fixed position, doesn't scroll */}
      {!readOnly && (
        <IconButton
          onClick={handleEmojiClick}
          size="small"
          aria-label="Insert emoji"
          sx={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: 1,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
          title={t('richTextEditor.emoji', 'Emoji')}
        >
          <EmojiIcon fontSize="small" />
        </IconButton>
      )}

      {/* Emoji Picker Popover */}
      <Popover
        open={emojiOpen}
        anchorEl={emojiAnchorEl}
        onClose={handleEmojiClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'transparent',
            },
          },
        }}
      >
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          theme={theme.palette.mode === 'dark' ? EmojiTheme.DARK : EmojiTheme.LIGHT}
          width={350}
          height={400}
          searchPlaceholder={t('richTextEditor.emojiSearch', 'Search emoji...')}
          previewConfig={{
            showPreview: false,
          }}
          categories={[
            {
              category: Categories.SUGGESTED,
              name: t('richTextEditor.emojiFrequentlyUsed', 'Frequently Used'),
            },
            {
              category: Categories.SMILEYS_PEOPLE,
              name: t('richTextEditor.emojiSmileysAndPeople', 'Smileys & People'),
            },
            {
              category: Categories.ANIMALS_NATURE,
              name: t('richTextEditor.emojiAnimalsAndNature', 'Animals & Nature'),
            },
            {
              category: Categories.FOOD_DRINK,
              name: t('richTextEditor.emojiFoodAndDrink', 'Food & Drink'),
            },
            {
              category: Categories.TRAVEL_PLACES,
              name: t('richTextEditor.emojiTravelAndPlaces', 'Travel & Places'),
            },
            {
              category: Categories.ACTIVITIES,
              name: t('richTextEditor.emojiActivities', 'Activities'),
            },
            {
              category: Categories.OBJECTS,
              name: t('richTextEditor.emojiObjects', 'Objects'),
            },
            {
              category: Categories.SYMBOLS,
              name: t('richTextEditor.emojiSymbols', 'Symbols'),
            },
            {
              category: Categories.FLAGS,
              name: t('richTextEditor.emojiFlags', 'Flags'),
            },
          ]}
        />
      </Popover>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={insertEmoji}>
          <ListItemIcon>
            <EmojiIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.insertEmoji', 'Insert Emoji')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={insertLink}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.insertLink', 'Insert Link')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={insertImage}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.insertImage', 'Insert Image')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={insertVideo}>
          <ListItemIcon>
            <VideoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.insertVideo', 'Insert Video')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={formatBold}>
          <ListItemIcon>
            <BoldIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.bold', 'Bold')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={formatItalic}>
          <ListItemIcon>
            <ItalicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.italic', 'Italic')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={formatUnderline}>
          <ListItemIcon>
            <UnderlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.underline', 'Underline')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={clearFormatting}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.clearFormatting', 'Clear Formatting')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Image Context Menu */}
      <Menu
        open={imageContextMenu !== null}
        onClose={() => setImageContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          imageContextMenu !== null
            ? { top: imageContextMenu.mouseY, left: imageContextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleEditImage}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.imageEdit')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyImage}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.imageCopy')}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteImage}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('richTextEditor.imageDelete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Link Insert Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={handleLinkDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('richTextEditor.insertLink', 'Insert Link')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              label={t('richTextEditor.linkUrl', 'URL')}
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              fullWidth
              required
              helperText={t('richTextEditor.linkUrlHelp', 'Enter the web address (URL)')}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && linkUrl) {
                  handleLinkInsert();
                }
              }}
            />
            <TextField
              label={t('richTextEditor.linkText', 'Display Text (Optional)')}
              placeholder={t('richTextEditor.linkTextPlaceholder', 'Text to display')}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              fullWidth
              helperText={t('richTextEditor.linkTextHelp', 'Leave empty to use URL as text')}
              disabled={savedSelectionRef.current && savedSelectionRef.current.length > 0}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLinkDialogClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleLinkInsert}
            variant="contained"
            disabled={!linkUrl}
          >
            {t('common.insert', 'Insert')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Insert Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={handleImageDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {isEditingImage ? t('richTextEditor.imageEdit') : t('richTextEditor.insertImage')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {/* Image Source Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, fontWeight: 600 }}>
                {t('richTextEditor.imageSource')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Image URL */}
                <TextField
                  autoFocus
                  label={t('richTextEditor.imageUrl')}
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  fullWidth
                  required
                  error={imageUrlValid === false}
                  helperText={
                    imageUrlValidating
                      ? t('richTextEditor.imageUrlValidating')
                      : imageUrlValid === false
                      ? t('richTextEditor.imageUrlInvalid')
                      : imageUrlValid === true && imageOriginalSize
                      ? `${t('richTextEditor.imageOriginalSize')}: ${imageOriginalSize.width} × ${imageOriginalSize.height}`
                      : t('richTextEditor.imageUrlHelp')
                  }
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && imageUrl && imageUrlValid === true) {
                      handleImageInsert();
                    }
                  }}
                />

                {/* Alt Text */}
                <TextField
                  label={t('richTextEditor.imageAltText')}
                  placeholder={t('richTextEditor.imageAltTextPlaceholder')}
                  value={imageAltText}
                  onChange={(e) => setImageAltText(e.target.value)}
                  fullWidth
                  helperText={t('richTextEditor.imageAltTextHelp')}
                />
              </Box>
            </Paper>

            {/* Advanced Options Accordion */}
            <Accordion
              expanded={advancedOptionsExpanded}
              onChange={handleAdvancedOptionsChange}
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 'none',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {t('richTextEditor.imageAdvancedOptions')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Width Selection and Aspect Ratio */}
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl fullWidth>
                <InputLabel>{t('richTextEditor.imageWidth')}</InputLabel>
                <Select
                  value={imageWidth}
                  label={t('richTextEditor.imageWidth')}
                  onChange={(e) => setImageWidth(e.target.value as any)}
                >
                  <MenuItem value="original">{t('richTextEditor.imageWidthOriginal')}</MenuItem>
                  <MenuItem value="25">{t('richTextEditor.imageWidth25')}</MenuItem>
                  <MenuItem value="50">{t('richTextEditor.imageWidth50')}</MenuItem>
                  <MenuItem value="75">{t('richTextEditor.imageWidth75')}</MenuItem>
                  <MenuItem value="100">{t('richTextEditor.imageWidth100')}</MenuItem>
                  <MenuItem value="custom">{t('richTextEditor.imageWidthCustom')}</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={imageAspectRatio}
                    onChange={(e) => setImageAspectRatio(e.target.checked)}
                  />
                }
                label={t('richTextEditor.imageAspectRatio')}
                sx={{ whiteSpace: 'nowrap' }}
              />
            </Box>

            {/* Custom Width Input */}
            {imageWidth === 'custom' && (
              <TextField
                label={t('richTextEditor.imageWidthCustom')}
                placeholder={t('richTextEditor.imageWidthCustomPlaceholder')}
                value={imageCustomWidth}
                onChange={(e) => setImageCustomWidth(e.target.value.replace(/[^0-9]/g, ''))}
                fullWidth
                helperText={t('richTextEditor.imageWidthCustomHelp')}
                type="number"
              />
            )}

            {/* Alignment */}
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('richTextEditor.imageAlign')}</FormLabel>
              <RadioGroup
                row
                value={imageAlign}
                onChange={(e) => setImageAlign(e.target.value as any)}
              >
                <FormControlLabel
                  value="left"
                  control={<Radio />}
                  label={t('richTextEditor.imageAlignLeft')}
                />
                <FormControlLabel
                  value="center"
                  control={<Radio />}
                  label={t('richTextEditor.imageAlignCenter')}
                />
                <FormControlLabel
                  value="right"
                  control={<Radio />}
                  label={t('richTextEditor.imageAlignRight')}
                />
              </RadioGroup>
            </FormControl>

            {/* Border Selection and Color - One Line */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>{t('richTextEditor.imageBorder')}</InputLabel>
                <Select
                  value={imageBorder}
                  label={t('richTextEditor.imageBorder')}
                  onChange={(e) => setImageBorder(e.target.value as any)}
                >
                  <MenuItem value="none">{t('richTextEditor.imageBorderNone')}</MenuItem>
                  <MenuItem value="thin">{t('richTextEditor.imageBorderThin')}</MenuItem>
                  <MenuItem value="medium">{t('richTextEditor.imageBorderMedium')}</MenuItem>
                  <MenuItem value="thick">{t('richTextEditor.imageBorderThick')}</MenuItem>
                </Select>
              </FormControl>

              {/* Border Color (conditional, same line) */}
              {imageBorder !== 'none' && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                  <TextField
                    label={t('richTextEditor.imageBorderColor')}
                    value={imageBorderColor}
                    onChange={(e) => setImageBorderColor(e.target.value)}
                    fullWidth
                    placeholder="#cccccc"
                  />
                  <Box
                    component="input"
                    type="color"
                    value={imageBorderColor}
                    onChange={(e) => setImageBorderColor((e.target as HTMLInputElement).value)}
                    sx={{
                      width: 60,
                      height: 40,
                      border: 'none',
                      borderRadius: 1,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                </Box>
              )}
            </Box>

            {/* Border Radius - One Line with Custom Input */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>{t('richTextEditor.imageBorderRadius')}</InputLabel>
                <Select
                  value={imageBorderRadius}
                  label={t('richTextEditor.imageBorderRadius')}
                  onChange={(e) => setImageBorderRadius(e.target.value as any)}
                >
                  <MenuItem value="none">{t('richTextEditor.imageBorderRadiusNone')}</MenuItem>
                  <MenuItem value="small">{t('richTextEditor.imageBorderRadiusSmall')}</MenuItem>
                  <MenuItem value="medium">{t('richTextEditor.imageBorderRadiusMedium')}</MenuItem>
                  <MenuItem value="large">{t('richTextEditor.imageBorderRadiusLarge')}</MenuItem>
                  <MenuItem value="custom">{t('richTextEditor.imageBorderRadiusCustom')}</MenuItem>
                </Select>
              </FormControl>

              {/* Custom Border Radius Input (conditional, same line) */}
              {imageBorderRadius === 'custom' && (
                <TextField
                  label={t('richTextEditor.imageCustomBorderRadius')}
                  type="number"
                  value={imageCustomBorderRadius}
                  onChange={(e) => setImageCustomBorderRadius(e.target.value)}
                  sx={{ flex: 1 }}
                  placeholder="8"
                  inputProps={{ min: 0 }}
                />
              )}
            </Box>

            {/* Shadow Selection and Direction - One Line */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>{t('richTextEditor.imageShadow')}</InputLabel>
                <Select
                  value={imageShadow}
                  label={t('richTextEditor.imageShadow')}
                  onChange={(e) => setImageShadow(e.target.value as any)}
                >
                  <MenuItem value="none">{t('richTextEditor.imageShadowNone')}</MenuItem>
                  <MenuItem value="small">{t('richTextEditor.imageShadowSmall')}</MenuItem>
                  <MenuItem value="medium">{t('richTextEditor.imageShadowMedium')}</MenuItem>
                  <MenuItem value="large">{t('richTextEditor.imageShadowLarge')}</MenuItem>
                </Select>
              </FormControl>

              {/* Shadow Direction (conditional, same line) */}
              {imageShadow !== 'none' && (
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>{t('richTextEditor.imageShadowDirection')}</InputLabel>
                  <Select
                    value={imageShadowDirection}
                    label={t('richTextEditor.imageShadowDirection')}
                    onChange={(e) => setImageShadowDirection(e.target.value as any)}
                  >
                    <MenuItem value="all">{t('richTextEditor.imageShadowDirectionAll')}</MenuItem>
                    <MenuItem value="top">{t('richTextEditor.imageShadowDirectionTop')}</MenuItem>
                    <MenuItem value="bottom">{t('richTextEditor.imageShadowDirectionBottom')}</MenuItem>
                    <MenuItem value="left">{t('richTextEditor.imageShadowDirectionLeft')}</MenuItem>
                    <MenuItem value="right">{t('richTextEditor.imageShadowDirectionRight')}</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>

            {/* Shadow Color (conditional, separate line) */}
            {imageShadow !== 'none' && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  label={t('richTextEditor.imageShadowColor')}
                  value={imageShadowColor}
                  onChange={(e) => setImageShadowColor(e.target.value)}
                  fullWidth
                  placeholder="rgba(0, 0, 0, 0.3)"
                />
                <Box
                  component="input"
                  type="color"
                  value={imageShadowColor.startsWith('rgba') || imageShadowColor.startsWith('rgb') ? '#000000' : imageShadowColor}
                  onChange={(e) => setImageShadowColor((e.target as HTMLInputElement).value)}
                  sx={{
                    width: 60,
                    height: 40,
                    border: 'none',
                    borderRadius: 1,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
              </Box>
            )}
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Preview Section - Outside accordion */}
            {imageUrl && (
              <>
                <Divider />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('richTextEditor.imagePreview')}
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: 'flex',
                      justifyContent: imageAlign === 'left' ? 'flex-start' : imageAlign === 'right' ? 'flex-end' : 'center',
                      minHeight: 200,
                      backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'inline-block',
                        maxWidth: '100%',
                      }}
                    >
                      <Box
                        component="img"
                        key={imageUrl}
                        src={imageUrl}
                        alt={imageAltText || 'Preview'}
                        sx={{
                          display: 'block',
                          height: imageAspectRatio ? 'auto' : undefined,
                          width: imageWidth === 'original' ? 'auto' : imageWidth === 'custom' && imageCustomWidth ? `${imageCustomWidth}px` : `${imageWidth}%`,
                          maxWidth: '100%',
                          maxHeight: 400,
                          objectFit: imageAspectRatio ? 'contain' : 'fill',
                          border: imageBorder !== 'none' ? `${imageBorder === 'thin' ? '1px' : imageBorder === 'medium' ? '2px' : '3px'} solid ${imageBorderColor}` : 'none',
                          boxShadow: imageShadow !== 'none' ? (() => {
                            const blur = imageShadow === 'small' ? '4px' : imageShadow === 'medium' ? '8px' : '16px';
                            const offset = imageShadow === 'small' ? '2px' : imageShadow === 'medium' ? '4px' : '8px';
                            let shadowValue = '';
                            if (imageShadowDirection === 'all') {
                              shadowValue = `0 0 ${blur}`;
                            } else if (imageShadowDirection === 'top') {
                              shadowValue = `0 -${offset} ${blur}`;
                            } else if (imageShadowDirection === 'bottom') {
                              shadowValue = `0 ${offset} ${blur}`;
                            } else if (imageShadowDirection === 'left') {
                              shadowValue = `-${offset} 0 ${blur}`;
                            } else if (imageShadowDirection === 'right') {
                              shadowValue = `${offset} 0 ${blur}`;
                            }
                            return `${shadowValue} ${imageShadowColor}`;
                          })() : 'none',
                          borderRadius: imageBorderRadius !== 'none' ?
                            imageBorderRadius === 'small' ? '4px' :
                            imageBorderRadius === 'medium' ? '8px' :
                            imageBorderRadius === 'large' ? '16px' :
                            imageBorderRadius === 'custom' && imageCustomBorderRadius ? `${imageCustomBorderRadius}px` : '0' : '0',
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          // Show alt text when image fails to load
                          const parent = target.parentElement;
                          if (parent && imageAltText) {
                            const altTextElement = document.createElement('div');
                            altTextElement.textContent = imageAltText;
                            altTextElement.style.padding = '20px';
                            altTextElement.style.color = theme.palette.text.secondary;
                            altTextElement.style.textAlign = 'center';
                            parent.appendChild(altTextElement);
                          }
                        }}
                      />
                    </Box>
                  </Paper>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImageDialogClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleImageInsert}
            variant="contained"
            disabled={
              !imageUrl ||
              imageUrlValid !== true ||
              imageUrlValidating ||
              (imageWidth === 'custom' && !imageCustomWidth)
            }
          >
            {t('common.insert')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Insert Dialog */}
      <Dialog
        open={videoDialogOpen}
        onClose={handleVideoDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('richTextEditor.insertVideo')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Video URL */}
            <TextField
              autoFocus
              label={t('richTextEditor.videoUrl')}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              fullWidth
              placeholder="https://www.youtube.com/watch?v=... or https://www.bilibili.com/video/BV..."
              helperText={t('richTextEditor.videoUrlHelp')}
            />

            {/* Width */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>{t('richTextEditor.videoWidth')}</InputLabel>
                <Select
                  value={videoWidth}
                  label={t('richTextEditor.videoWidth')}
                  onChange={(e) => setVideoWidth(e.target.value as any)}
                >
                  <MenuItem value="25">25%</MenuItem>
                  <MenuItem value="50">50%</MenuItem>
                  <MenuItem value="75">75%</MenuItem>
                  <MenuItem value="100">100%</MenuItem>
                  <MenuItem value="custom">{t('richTextEditor.videoWidthCustom')}</MenuItem>
                </Select>
              </FormControl>

              {/* Custom Width (conditional) */}
              {videoWidth === 'custom' && (
                <TextField
                  label={t('richTextEditor.videoWidthPixels')}
                  value={videoCustomWidth}
                  onChange={(e) => setVideoCustomWidth(e.target.value.replace(/\D/g, ''))}
                  placeholder="640"
                  sx={{ flex: 1 }}
                  type="number"
                />
              )}
            </Box>

            {/* Alignment */}
            <FormControl>
              <FormLabel>{t('richTextEditor.videoAlign')}</FormLabel>
              <RadioGroup
                row
                value={videoAlign}
                onChange={(e) => setVideoAlign(e.target.value as any)}
              >
                <FormControlLabel
                  value="left"
                  control={<Radio />}
                  label={t('richTextEditor.videoAlignLeft')}
                />
                <FormControlLabel
                  value="center"
                  control={<Radio />}
                  label={t('richTextEditor.videoAlignCenter')}
                />
                <FormControlLabel
                  value="right"
                  control={<Radio />}
                  label={t('richTextEditor.videoAlignRight')}
                />
              </RadioGroup>
            </FormControl>

            {/* Autoplay */}
            <FormControl>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={videoAutoplay}
                    onChange={(e) => setVideoAutoplay(e.target.checked)}
                  />
                }
                label={t('richTextEditor.videoAutoplay')}
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                {t('richTextEditor.videoAutoplayHelp')}
              </Typography>
            </FormControl>

            {/* Video Preview */}
            {videoPreviewUrl && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('richTextEditor.videoPreview')}
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      paddingBottom: '56.25%', // 16:9 aspect ratio
                      height: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <iframe
                      src={videoPreviewUrl}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none',
                      }}
                      allowFullScreen
                    />
                  </Box>
                </Paper>
              </Box>
            )}

            {/* Invalid URL message */}
            {videoUrl && !videoPreviewUrl && (
              <Typography variant="body2" color="error">
                {t('richTextEditor.invalidVideoUrl')}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleVideoDialogClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleVideoInsert}
            variant="contained"
            disabled={!videoUrl || !videoPreviewUrl || (videoWidth === 'custom' && !videoCustomWidth)}
          >
            {t('common.insert')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RichTextEditor;

