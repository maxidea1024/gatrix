import React, { useMemo, useRef, useEffect, useState } from "react";
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
  ClickAwayListener,
  Portal,
} from "@mui/material";
import {
  EmojiEmotions as EmojiIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatStrikethrough as StrikethroughIcon,
  Link as LinkIcon,
  FormatClear as ClearIcon,
  Image as ImageIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  ContentCopy as CopyIcon,
  ContentCut as CutIcon,
  ContentPaste as PasteIcon,
  Delete as DeleteIcon,
  VideoLibrary as VideoIcon,
  FormatSize as SizeIcon,
  FormatColorText as ColorIcon,
} from "@mui/icons-material";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import EmojiPicker, {
  EmojiClickData,
  Theme as EmojiTheme,
  Categories,
} from "emoji-picker-react";

// Register custom image blot for Quill to preserve style attribute
const ImageBlot = Quill.import("formats/image") as any;

class CustomImageBlot extends ImageBlot {
  static formats(node: HTMLImageElement) {
    // Preserve all attributes including style
    const formats: any = {};
    if (node.hasAttribute("alt")) {
      formats.alt = node.getAttribute("alt");
    }
    if (node.hasAttribute("style")) {
      formats.style = node.getAttribute("style");
    }
    if (node.hasAttribute("data-image-metadata")) {
      formats["data-image-metadata"] = node.getAttribute("data-image-metadata");
    }
    return formats;
  }

  format(name: string, value: any) {
    if (name === "style" || name === "alt" || name === "data-image-metadata") {
      if (value) {
        this.domNode.setAttribute(name, value);
      } else {
        this.domNode.removeAttribute(name);
      }
    } else {
      super.format(name, value);
    }
  }
}

// Register custom video blot for Quill
const BlockEmbed = Quill.import("blots/block/embed") as any;

class VideoBlot extends BlockEmbed {
  static blotName = "video";
  static tagName = "div";
  static className = "video-wrapper";

  static create(value: any) {
    const node = super.create(value) as HTMLDivElement;
    // Set contenteditable to false to prevent editing the iframe
    // But keep the wrapper deletable by Quill
    node.setAttribute("contenteditable", "false");
    // Add data attribute to help with selection and deletion
    node.setAttribute("data-video-embed", "true");

    const iframe = document.createElement("iframe");

    if (typeof value === "string") {
      iframe.setAttribute("src", value);
    } else {
      iframe.setAttribute("src", value.src);
      if (value.width) iframe.style.width = value.width;
      if (value.height) iframe.style.height = value.height;
      if (value.align) {
        if (value.align === "center") {
          iframe.style.display = "block";
          iframe.style.marginLeft = "auto";
          iframe.style.marginRight = "auto";
        } else if (value.align === "left") {
          iframe.style.float = "left";
          iframe.style.marginRight = "10px";
          iframe.style.marginBottom = "10px";
        } else if (value.align === "right") {
          iframe.style.float = "right";
          iframe.style.marginLeft = "10px";
          iframe.style.marginBottom = "10px";
        }
      }
    }

    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    );
    iframe.style.border = "none";

    // Remove margin to avoid dead space
    node.style.margin = "0";
    node.appendChild(iframe);

    return node;
  }

  static value(node: HTMLDivElement) {
    const iframe = node.querySelector("iframe");
    if (!iframe) return { src: "" };

    return {
      src: iframe.getAttribute("src"),
      width: iframe.style.width,
      height: iframe.style.height,
      align:
        iframe.style.float ||
        (iframe.style.display === "block" && iframe.style.marginLeft === "auto"
          ? "center"
          : "left"),
    };
  }

  // Override deleteAt to ensure proper deletion
  deleteAt(index: number, length: number) {
    super.deleteAt(index, length);
  }
}

Quill.register(CustomImageBlot, true); // true to overwrite default image format
Quill.register(VideoBlot, true); // true to suppress overwrite warning

// Centralized effect styles map for text effects
const Inline = Quill.import("blots/inline") as any;

const TEXT_EFFECT_STYLES: { [key: string]: string } = {
  // No effect - reset all text styling
  none: "text-shadow: none; -webkit-text-stroke: 0; -webkit-text-fill-color: inherit; background: none; animation: none; display: inline",
  // Shadow effects
  shadow: "text-shadow: 2px 2px 4px rgba(0,0,0,0.5)",
  "shadow-light": "text-shadow: 1px 1px 2px rgba(0,0,0,0.3)",
  "shadow-hard": "text-shadow: 3px 3px 0 rgba(0,0,0,0.8)",
  "shadow-multi": "text-shadow: 1px 1px 0 #000, 2px 2px 0 #333, 3px 3px 0 #666",
  // Glow effects
  glow: "text-shadow: 0 0 10px currentColor, 0 0 20px currentColor",
  "glow-blue":
    "text-shadow: 0 0 10px #00bfff, 0 0 20px #00bfff, 0 0 30px #00bfff",
  "glow-gold":
    "text-shadow: 0 0 10px #ffd700, 0 0 20px #ffd700, 0 0 30px #ffd700",
  "glow-red":
    "text-shadow: 0 0 10px #ff4444, 0 0 20px #ff4444, 0 0 30px #ff4444",
  "glow-green":
    "text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88, 0 0 30px #00ff88",
  "glow-purple":
    "text-shadow: 0 0 10px #a855f7, 0 0 20px #a855f7, 0 0 30px #a855f7",
  // Outline effects
  outline: "-webkit-text-stroke: 1px currentColor; paint-order: stroke fill",
  "outline-white": "-webkit-text-stroke: 1px white; paint-order: stroke fill",
  "outline-black": "-webkit-text-stroke: 1px black; paint-order: stroke fill",
  "outline-thick":
    "-webkit-text-stroke: 2px currentColor; paint-order: stroke fill",
  // 3D effects
  emboss:
    "text-shadow: -1px -1px 0 rgba(255,255,255,0.5), 1px 1px 0 rgba(0,0,0,0.5)",
  engrave:
    "text-shadow: 1px 1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(0,0,0,0.5)",
  "3d": "text-shadow: 0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb, 0 4px 0 #b9b9b9, 0 5px 0 #aaa, 0 6px 1px rgba(0,0,0,.1), 0 0 5px rgba(0,0,0,.1)",
  retro: "text-shadow: 3px 3px 0 #f0f, 6px 6px 0 #0ff",
  // Neon effects
  neon: "text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #ff00de, 0 0 20px #ff00de",
  "neon-cyan":
    "text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff",
  "neon-orange":
    "text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #ff6b00, 0 0 20px #ff6b00, 0 0 30px #ff6b00",
  // Gradient text (using background-clip)
  "gradient-rainbow":
    "background: linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text",
  "gradient-gold":
    "background: linear-gradient(180deg, #ffd700, #ffb700, #ff9500); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text",
  "gradient-silver":
    "background: linear-gradient(180deg, #e8e8e8, #bbb, #888); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text",
  "gradient-fire":
    "background: linear-gradient(180deg, #ff0000, #ff6600, #ffcc00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text",
  "gradient-ice":
    "background: linear-gradient(180deg, #00bfff, #87ceeb, #e0ffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text",
  "gradient-sunset":
    "background: linear-gradient(90deg, #ff512f, #dd2476); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text",
  // Animation effects (pure CSS)
  "anim-blink": "animation: ql-blink 1s step-end infinite",
  "anim-pulse":
    "animation: ql-pulse 1.5s ease-in-out infinite; display: inline-block",
  "anim-shake":
    "animation: ql-shake 0.5s ease-in-out infinite; display: inline-block",
  "anim-bounce":
    "animation: ql-bounce 0.6s ease infinite; display: inline-block",
  "anim-glow-pulse": "animation: ql-glow-pulse 1.5s ease-in-out infinite",
  "anim-rainbow":
    "background: linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0000); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: ql-rainbow 3s linear infinite",
  "anim-float":
    "animation: ql-float 2s ease-in-out infinite; display: inline-block",
  "anim-jelly": "animation: ql-jelly 0.8s ease infinite; display: inline-block",
  "anim-swing":
    "animation: ql-swing 1s ease-in-out infinite; display: inline-block; transform-origin: top center",
  "anim-heartbeat":
    "animation: ql-heartbeat 1.2s ease-in-out infinite; display: inline-block",
};

// Get Parchment for creating replacement blots
const Parchment = Quill.import("parchment") as any;

class TextEffectBlot extends Inline {
  static blotName = "textEffect";
  static tagName = "span";
  static className = "ql-text-effect";

  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.setAttribute("data-effect", value);
    const style = TEXT_EFFECT_STYLES[value];
    if (style) {
      node.setAttribute("style", style);
    }
    return node;
  }

  static formats(node: HTMLElement) {
    return node.getAttribute("data-effect");
  }

  format(name: string, value: any) {
    if (name === "textEffect" && value) {
      this.domNode.setAttribute("data-effect", value);
      const style = TEXT_EFFECT_STYLES[value];
      if (style) {
        this.domNode.setAttribute("style", style);
      }
    } else {
      super.format(name, value);
    }
  }
}

Quill.register(TextEffectBlot, true);

// Font list for editor - Universal fonts first, then CJK fonts
const fontList = [
  // Universal / Multi-language fonts
  "Noto Sans",
  "Inter",
  "Roboto",
  // Korean fonts
  "Noto Sans KR",
  "Pretendard",
  "Spoqa Han Sans Neo",
  "Nanum Gothic",
  "Nanum Myeongjo",
  "Malgun Gothic",
  // Chinese fonts
  "Noto Sans SC",
  "Source Han Sans SC",
  "Microsoft YaHei",
  "SimHei",
  "SimSun",
  // Western fonts
  "Arial",
  "Helvetica",
  "Verdana",
  "Times New Roman",
  "Georgia",
  "Courier New",
];

// Register Font, Size, and Align Attributors as styles instead of classes
// to ensure they are preserved during copy-paste and better portability
const FontAttributor = Quill.import("attributors/style/font") as any;
FontAttributor.whitelist = fontList;
Quill.register(FontAttributor, true);

const SizeAttributor = Quill.import("attributors/style/size") as any;
SizeAttributor.whitelist = ["0.75em", "1.5em", "2.5em"];
Quill.register(SizeAttributor, true);

const AlignAttributor = Quill.import("attributors/style/align") as any;
Quill.register(AlignAttributor, true);

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
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [emojiPosition, setEmojiPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [imageContextMenu, setImageContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    imgElement: HTMLImageElement;
  } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageWidth, setImageWidth] = useState<
    "original" | "25" | "50" | "75" | "100" | "custom"
  >("100");
  const [imageCustomWidth, setImageCustomWidth] = useState("");
  const [imageAlign, setImageAlign] = useState<"left" | "center" | "right">(
    "center",
  );
  const [imageBorder, setImageBorder] = useState<
    "none" | "thin" | "medium" | "thick"
  >("none");
  const [imageBorderColor, setImageBorderColor] = useState("#cccccc");
  const [imageAltText, setImageAltText] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState(true);
  const [imageShadow, setImageShadow] = useState<
    "none" | "small" | "medium" | "large"
  >("none");
  const [imageShadowColor, setImageShadowColor] =
    useState("rgba(0, 0, 0, 0.3)");
  const [imageShadowDirection, setImageShadowDirection] = useState<
    "all" | "top" | "bottom" | "left" | "right"
  >("all");
  const [imageBorderRadius, setImageBorderRadius] = useState<
    "none" | "small" | "medium" | "large" | "custom"
  >("none");
  const [imageCustomBorderRadius, setImageCustomBorderRadius] = useState("");
  const [advancedOptionsExpanded, setAdvancedOptionsExpanded] = useState(() => {
    const saved = localStorage.getItem(
      "richTextEditor.advancedOptionsExpanded",
    );
    return saved !== null ? saved === "true" : false; // Default to collapsed
  });
  const [imageUrlValid, setImageUrlValid] = useState<boolean | null>(null);
  const [imageUrlValidating, setImageUrlValidating] = useState(false);
  const [imageOriginalSize, setImageOriginalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoWidth, setVideoWidth] = useState<
    "25" | "50" | "75" | "100" | "custom"
  >("100");
  const [videoCustomWidth, setVideoCustomWidth] = useState("");
  const [videoAlign, setVideoAlign] = useState<"left" | "center" | "right">(
    "center",
  );
  const [videoAutoplay, setVideoAutoplay] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoLoop, setVideoLoop] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoUrlValidating, setVideoUrlValidating] = useState(false);
  const savedSelectionRef = useRef<{ index: number; length: number } | null>(
    null,
  );
  const imageValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Floating toolbar state
  const [floatingToolbar, setFloatingToolbar] = useState<{
    visible: boolean;
    top: number;
    left: number;
  }>({ visible: false, top: 0, left: 0 });
  const floatingToolbarRef = useRef<HTMLDivElement | null>(null);

  // Floating toolbar dropdown states (controlled to ensure only one is open at a time)
  const [floatingFontOpen, setFloatingFontOpen] = useState(false);
  const [floatingSizeOpen, setFloatingSizeOpen] = useState(false);
  const [floatingEffectOpen, setFloatingEffectOpen] = useState(false);

  // Save advanced options state to localStorage
  const handleAdvancedOptionsChange = (
    event: React.SyntheticEvent,
    isExpanded: boolean,
  ) => {
    setAdvancedOptionsExpanded(isExpanded);
    localStorage.setItem(
      "richTextEditor.advancedOptionsExpanded",
      String(isExpanded),
    );
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
        setImageOriginalSize({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
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

  // Apply last used font when editor opens with empty content
  useEffect(() => {
    // Use a small timeout to ensure Quill is fully initialized
    const timeoutId = setTimeout(() => {
      if (quillRef.current && !readOnly) {
        const editor = quillRef.current.getEditor();
        const text = editor.getText().trim();

        // Only apply last used font if content is truly empty (just a newline from Quill)
        if (text === "") {
          const lastUsedFont = localStorage.getItem(
            "richTextEditor.lastUsedFont",
          );
          if (lastUsedFont && fontList.includes(lastUsedFont)) {
            // Set format for the editor so new text will use this font
            editor.format("font", lastUsedFont);

            // Also update the toolbar UI to reflect the selected font
            const toolbar = editor.getModule("toolbar") as any;
            if (toolbar?.container) {
              const fontPickerLabel = toolbar.container.querySelector(
                ".ql-font .ql-picker-label",
              );
              if (fontPickerLabel) {
                fontPickerLabel.setAttribute("data-value", lastUsedFont);
              }
            }
          }
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Save cursor position continuously and show floating toolbar on text selection
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();

      const handleSelectionChange = (
        range: { index: number; length: number } | null,
      ) => {
        if (range) {
          savedSelectionRef.current = range;

          // Show floating toolbar when text is selected
          if (range.length > 0 && !readOnly) {
            // Get selection bounds using native browser API
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const nativeRange = selection.getRangeAt(0);
              const rect = nativeRange.getBoundingClientRect();

              // Position the toolbar above the selection using viewport coordinates
              // Use fixed positioning to avoid clipping by parent overflow
              setFloatingToolbar({
                visible: true,
                top: rect.top - 45, // 45px above selection (viewport-relative)
                left: rect.left + rect.width / 2 - 200, // Center the toolbar (wider now with font/size selectors)
              });
            }
          } else {
            setFloatingToolbar((prev) => ({ ...prev, visible: false }));
          }
        } else {
          // Delay hiding to allow clicking on toolbar buttons
          setTimeout(() => {
            if (!floatingToolbarRef.current?.contains(document.activeElement)) {
              setFloatingToolbar((prev) => ({ ...prev, visible: false }));
            }
          }, 150);
        }
      };

      // Listen to selection changes
      editor.on("selection-change", handleSelectionChange);

      return () => {
        editor.off("selection-change", handleSelectionChange);
      };
    }
  }, [readOnly]);

  // Handle image right-click context menu
  useEffect(() => {
    if (quillRef.current && !readOnly) {
      const editor = quillRef.current.getEditor();
      const editorRoot = editor.root;

      const handleImageContextMenu = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === "IMG") {
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
      editorRoot.addEventListener("contextmenu", handleImageContextMenu, true);

      return () => {
        editorRoot.removeEventListener(
          "contextmenu",
          handleImageContextMenu,
          true,
        );
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
      setVideoUrlValidating(false);
      return;
    }

    // Clear preview immediately and set validating state to prevent error message flash
    setVideoPreviewUrl(null);
    setVideoUrlValidating(true);

    // Debounce validation
    videoValidationTimeoutRef.current = setTimeout(() => {
      const videoInfo = getVideoEmbedUrl(
        videoUrl,
        videoAutoplay,
        videoMuted,
        videoLoop,
      );
      if (videoInfo) {
        setVideoPreviewUrl(videoInfo.embedUrl);
      } else {
        setVideoPreviewUrl(null);
      }
      setVideoUrlValidating(false);
    }, 300); // Reduced from 500ms to 300ms

    return () => {
      if (videoValidationTimeoutRef.current) {
        clearTimeout(videoValidationTimeoutRef.current);
      }
    };
  }, [videoUrl, videoAutoplay, videoMuted, videoLoop]);

  // Extract video embed URL from YouTube, Bilibili, or TikTok URL
  const getVideoEmbedUrl = (
    url: string,
    autoplay: boolean = false,
    muted: boolean = false,
    loop: boolean = false,
  ): {
    embedUrl: string;
    platform: "youtube" | "bilibili" | "tiktok" | null;
  } | null => {
    try {
      const urlObj = new URL(url);

      // YouTube
      if (
        urlObj.hostname.includes("youtube.com") ||
        urlObj.hostname.includes("youtu.be")
      ) {
        let videoId = "";

        if (urlObj.hostname.includes("youtu.be")) {
          // Short URL: https://youtu.be/VIDEO_ID
          videoId = urlObj.pathname.slice(1);
        } else if (urlObj.pathname.includes("/embed/")) {
          // Already embed URL
          videoId = urlObj.pathname.split("/embed/")[1];
        } else {
          // Regular URL: https://www.youtube.com/watch?v=VIDEO_ID
          videoId = urlObj.searchParams.get("v") || "";
        }

        if (videoId) {
          // Build YouTube embed URL with parameters
          const params = new URLSearchParams();
          params.set("autoplay", autoplay ? "1" : "0");
          params.set("mute", muted ? "1" : "0");
          if (loop) {
            params.set("loop", "1");
            params.set("playlist", videoId); // Required for loop to work
          }
          return {
            embedUrl: `https://www.youtube.com/embed/${videoId}?${params.toString()}`,
            platform: "youtube",
          };
        }
      }

      // Bilibili
      if (urlObj.hostname.includes("bilibili.com")) {
        let bvid = "";

        // Extract BV ID from URL
        const pathMatch = urlObj.pathname.match(/\/(BV[\w]+)/);
        if (pathMatch) {
          bvid = pathMatch[1];
        }

        if (bvid) {
          // Build Bilibili embed URL with parameters
          const params = new URLSearchParams();
          params.set("bvid", bvid);
          params.set("autoplay", autoplay ? "1" : "0");
          params.set("muted", muted ? "1" : "0");
          // Note: Bilibili doesn't have a native loop parameter
          return {
            embedUrl: `https://player.bilibili.com/player.html?${params.toString()}`,
            platform: "bilibili",
          };
        }
      }

      // TikTok
      if (urlObj.hostname.includes("tiktok.com")) {
        // Extract video ID from URL patterns:
        // https://www.tiktok.com/@username/video/1234567890
        // https://www.tiktok.com/player/v1/1234567890
        // https://vm.tiktok.com/XXXXXXXX (short URL - ID in path)
        let videoId = "";

        const videoMatch = urlObj.pathname.match(/\/video\/(\d+)/);
        const playerMatch = urlObj.pathname.match(/\/player\/v1\/(\d+)/);

        if (videoMatch) {
          videoId = videoMatch[1];
        } else if (playerMatch) {
          videoId = playerMatch[1];
        }

        if (videoId) {
          // Build TikTok embed URL with parameters
          const params = new URLSearchParams();
          params.set("autoplay", autoplay ? "1" : "0");
          if (loop) {
            params.set("loop", "1");
          }
          params.set("music_info", "1");
          params.set("description", "1");
          return {
            embedUrl: `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`,
            platform: "tiktok",
          };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Handle emoji picker - used as Quill toolbar handler
  const handleEmojiClick = () => {
    // Save current selection before opening picker
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = editor.getSelection();
      if (selection) {
        savedSelectionRef.current = selection;
      }
      // Find the emoji button in the toolbar to use as anchor
      const toolbar = editor.getModule("toolbar") as any;
      if (toolbar?.container) {
        const emojiButton = toolbar.container.querySelector(".ql-emoji");
        if (emojiButton) {
          setEmojiAnchorEl(emojiButton as HTMLElement);
          return;
        }
      }
      // Fallback: use the editor container as anchor
      const editorContainer = editor.container as HTMLElement;
      if (editorContainer) {
        setEmojiAnchorEl(editorContainer);
      }
    }
  };

  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
    setEmojiPosition(null);
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
        : null,
    );
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const insertEmoji = () => {
    // Save context menu position for emoji picker
    const position = contextMenu
      ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
      : null;
    handleContextMenuClose();
    // Trigger emoji picker with position
    if (position) {
      setEmojiPosition(position);
    }
    handleEmojiClick();
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
        setLinkText("");
      }
    }

    setLinkUrl("");
    setLinkDialogOpen(true);
  };

  const handleLinkDialogClose = () => {
    setLinkDialogOpen(false);
    setLinkUrl("");
    setLinkText("");
  };

  const handleLinkInsert = () => {
    if (quillRef.current && linkUrl) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;

      if (selection && selection.length > 0) {
        // Apply link to selected text
        editor.formatText(selection.index, selection.length, "link", linkUrl);
      } else {
        // Insert new link with text
        const position = selection ? selection.index : editor.getLength();
        const textToInsert = linkText || linkUrl;
        editor.insertText(position, textToInsert, "link", linkUrl);
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
    setVideoUrl("");
    setVideoWidth("100");
    setVideoCustomWidth("");
    setVideoAlign("center");
    setVideoAutoplay(false);
    setVideoMuted(false);
    setVideoLoop(false);
    setVideoPreviewUrl(null);
    setVideoUrlValidating(false);

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
      const videoInfo = getVideoEmbedUrl(
        videoUrl,
        videoAutoplay,
        videoMuted,
        videoLoop,
      );

      if (!videoInfo) {
        alert(
          t(
            "richTextEditor.invalidVideoUrl",
            "Invalid video URL. Please use YouTube, Bilibili, or TikTok URL.",
          ),
        );
        return;
      }

      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      let position = selection ? selection.index : editor.getLength();

      // If inserting at the very beginning (position 0), add an empty line first
      // This allows users to add content above the video later
      if (position === 0) {
        editor.insertText(0, "\n");
        position = 1; // Insert video after the empty line
      }

      // Calculate width
      let width = "100%";
      if (videoWidth === "custom" && videoCustomWidth) {
        width = `${videoCustomWidth}px`;
      } else if (videoWidth !== "100") {
        width = `${videoWidth}%`;
      }

      // Calculate height (16:9 aspect ratio)
      const widthValue =
        videoWidth === "custom" && videoCustomWidth
          ? parseInt(videoCustomWidth)
          : 640;
      const height = Math.round((widthValue * 9) / 16);

      // Build iframe HTML
      let iframeStyle = `width: ${width}; height: ${height}px; border: none;`;

      // Alignment
      if (videoAlign === "center") {
        iframeStyle +=
          " display: block; margin-left: auto; margin-right: auto;";
      } else if (videoAlign === "left") {
        iframeStyle += " float: left; margin-right: 10px; margin-bottom: 10px;";
      } else if (videoAlign === "right") {
        iframeStyle += " float: right; margin-left: 10px; margin-bottom: 10px;";
      }

      // Insert video - Quill automatically handles newlines for BlockEmbed
      editor.insertEmbed(position, "video", {
        src: videoInfo.embedUrl,
        width: width,
        height: `${height}px`,
        align: videoAlign,
      });

      // Set cursor position after the video
      editor.setSelection(position + 1, 0);

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
        editor.formatText(
          selection.index,
          selection.length,
          "bold",
          !format.bold,
        );
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
        editor.formatText(
          selection.index,
          selection.length,
          "italic",
          !format.italic,
        );
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
        editor.formatText(
          selection.index,
          selection.length,
          "underline",
          !format.underline,
        );
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

  const formatStrikethrough = () => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        const format = editor.getFormat(selection.index, selection.length);
        editor.formatText(
          selection.index,
          selection.length,
          "strike",
          !format.strike,
        );
        editor.focus();
      }
    }
  };

  // Clipboard functions for floating toolbar - use HTML to preserve formatting
  const handleCut = async () => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        // Get HTML content for the selection
        const contents = editor.getContents(selection.index, selection.length);
        const tempContainer = document.createElement("div");
        const tempQuill = new Quill(tempContainer);
        tempQuill.setContents(contents);
        const html = tempContainer.querySelector(".ql-editor")?.innerHTML || "";
        const text = editor.getText(selection.index, selection.length);

        try {
          // Write both HTML and plain text to clipboard
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
          editor.deleteText(selection.index, selection.length);
          setFloatingToolbar((prev) => ({ ...prev, visible: false }));
        } catch (err) {
          // Fallback to plain text
          try {
            await navigator.clipboard.writeText(text);
            editor.deleteText(selection.index, selection.length);
            setFloatingToolbar((prev) => ({ ...prev, visible: false }));
          } catch (fallbackErr) {
            console.error("Failed to cut:", fallbackErr);
          }
        }
      }
    }
  };

  const handleCopy = async () => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const selection = savedSelectionRef.current;
      if (selection && selection.length > 0) {
        // Get HTML content for the selection
        const contents = editor.getContents(selection.index, selection.length);
        const tempContainer = document.createElement("div");
        const tempQuill = new Quill(tempContainer);
        tempQuill.setContents(contents);
        const html = tempContainer.querySelector(".ql-editor")?.innerHTML || "";
        const text = editor.getText(selection.index, selection.length);

        try {
          // Write both HTML and plain text to clipboard
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
        } catch (err) {
          // Fallback to plain text
          try {
            await navigator.clipboard.writeText(text);
          } catch (fallbackErr) {
            console.error("Failed to copy:", fallbackErr);
          }
        }
      }
    }
  };

  const handlePaste = async () => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const Delta = Quill.import("delta");
      const selection = savedSelectionRef.current || {
        index: editor.getLength(),
        length: 0,
      };
      try {
        const clipboardItems = await navigator.clipboard.read();
        let html = "";
        let text = "";

        for (const item of clipboardItems) {
          if (item.types.includes("text/html")) {
            const blob = await item.getType("text/html");
            html = await blob.text();
          }
          if (item.types.includes("text/plain")) {
            const blob = await item.getType("text/plain");
            text = await blob.text();
          }
        }

        if (selection.length > 0) {
          editor.deleteText(selection.index, selection.length);
        }

        if (html) {
          // Convert HTML to delta
          const delta = editor.clipboard.convert(html);

          // Trim trailing newline if it exists to prevent extra line feed
          const ops = delta.ops;
          if (ops && ops.length > 0) {
            const lastOp = ops[ops.length - 1];
            if (
              typeof lastOp.insert === "string" &&
              lastOp.insert.endsWith("\n")
            ) {
              lastOp.insert = lastOp.insert.slice(0, -1);
            }
          }

          // Insert the delta
          editor.updateContents(
            new Delta().retain(selection.index).concat(delta),
          );
          editor.setSelection(selection.index + delta.length(), 0);
        } else if (text) {
          editor.insertText(selection.index, text);
          editor.setSelection(selection.index + text.length, 0);
        }

        setFloatingToolbar((prev) => ({ ...prev, visible: false }));
        editor.focus();
      } catch (err) {
        // Fallback to plain text
        try {
          const text = await navigator.clipboard.readText();
          if (selection.length > 0) {
            editor.deleteText(selection.index, selection.length);
          }
          editor.insertText(selection.index, text);
          editor.setSelection(selection.index + text.length, 0);
          setFloatingToolbar((prev) => ({ ...prev, visible: false }));
          editor.focus();
        } catch (fallbackErr) {
          console.error("Failed to paste:", fallbackErr);
        }
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
    setImageUrl("");
    setImageWidth("100");
    setImageCustomWidth("");
    setImageAlign("center");
    setImageBorder("none");
    setImageBorderColor("#cccccc");
    setImageAltText("");
    setImageAspectRatio(true);
    setImageShadow("none");
    setImageShadowColor("rgba(0, 0, 0, 0.3)");
    setImageShadowDirection("all");
    setImageBorderRadius("none");
    setImageCustomBorderRadius("");
    setImageUrlValid(null);
    setImageUrlValidating(false);
    setImageOriginalSize(null);
    setImageDialogOpen(true);
  };

  // Handle image editing
  const handleEditImage = () => {
    if (!imageContextMenu) return;

    const imgElement = imageContextMenu.imgElement;
    const metadataStr = imgElement.getAttribute("data-image-metadata");

    // Load image data
    setImageUrl(imgElement.src);
    setImageAltText(imgElement.alt || "");

    // Load metadata if available
    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr);
        setImageWidth(metadata.width || "100");
        setImageCustomWidth(metadata.customWidth || "");
        setImageAlign(metadata.align || "center");
        setImageBorder(metadata.border || "none");
        setImageBorderColor(metadata.borderColor || "#cccccc");
        setImageAspectRatio(
          metadata.aspectRatio !== undefined ? metadata.aspectRatio : true,
        );
        setImageShadow(metadata.shadow || "none");
        setImageShadowColor(metadata.shadowColor || "rgba(0, 0, 0, 0.3)");
        setImageShadowDirection(metadata.shadowDirection || "all");
        setImageBorderRadius(metadata.borderRadius || "none");
        setImageCustomBorderRadius(metadata.customBorderRadius || "");
      } catch (e) {
        // If metadata parsing fails, use defaults
        console.error("Failed to parse image metadata:", e);
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
    const metadataStr = imgElement.getAttribute("data-image-metadata");
    const src = imgElement.src;
    const alt = imgElement.alt || "";
    const style = imgElement.getAttribute("style") || "";

    // Store the copied image data in a temporary state or use clipboard API
    // We'll insert it at the current cursor position
    const selection = editor.getSelection();
    const position = selection ? selection.index : editor.getLength();

    // Insert a newline before image if not at the start
    if (position > 0) {
      const previousChar = editor.getText(position - 1, 1);
      if (previousChar !== "\n") {
        editor.insertText(position, "\n");
        editor.insertEmbed(position + 1, "image", src);
        editor.insertText(position + 2, "\n");
        editor.setSelection(position + 3, 0);
      } else {
        editor.insertEmbed(position, "image", src);
        editor.insertText(position + 1, "\n");
        editor.setSelection(position + 2, 0);
      }
    } else {
      editor.insertEmbed(position, "image", src);
      editor.insertText(position + 1, "\n");
      editor.setSelection(position + 2, 0);
    }

    // Apply the same style and metadata to the newly inserted image
    setTimeout(() => {
      const imgElements = editor.root.querySelectorAll("img");
      const newImgElement = Array.from(imgElements).find(
        (img) => (img as HTMLImageElement).src === src && img !== imgElement,
      ) as HTMLImageElement | undefined;

      if (newImgElement) {
        newImgElement.setAttribute("alt", alt);
        if (style) {
          newImgElement.setAttribute("style", style);
        }
        if (metadataStr) {
          newImgElement.setAttribute("data-image-metadata", metadataStr);
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
      if (op.insert && typeof op.insert === "object" && "image" in op.insert) {
        const img = op.insert as { image: string };
        if (img.image === imgElement.src) {
          // Delete the image
          editor.deleteText(index, 1);
        }
      }
      if (typeof op.insert === "string") {
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
    setImageUrl("");
    setImageWidth("100");
    setImageCustomWidth("");
    setImageAlign("center");
    setImageBorder("none");
    setImageBorderColor("#cccccc");
    setImageAltText("");
    setImageAspectRatio(true);
    setImageShadow("none");
    setImageShadowColor("rgba(0, 0, 0, 0.3)");
    setImageShadowDirection("all");
    setImageBorderRadius("none");
    setImageCustomBorderRadius("");
    setImageUrlValid(null);
    setImageUrlValidating(false);
    setImageOriginalSize(null);
  };

  // Apply styles to image element
  const applyImageStyles = (imgElement: HTMLImageElement) => {
    // Set alt text
    if (imageAltText) {
      imgElement.setAttribute("alt", imageAltText);
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
    imgElement.setAttribute("data-image-metadata", JSON.stringify(metadata));

    // Build image style
    const styles: string[] = [];

    // Width
    if (imageWidth === "original") {
      styles.push("max-width: 100%");
    } else if (imageWidth === "custom" && imageCustomWidth) {
      styles.push(`width: ${imageCustomWidth}px`);
      styles.push("max-width: 100%");
    } else {
      styles.push(`width: ${imageWidth}%`);
    }

    // Height - aspect ratio
    if (imageAspectRatio) {
      styles.push("height: auto");
    }

    // Alignment
    if (imageAlign === "center") {
      styles.push("display: block");
      styles.push("margin-left: auto");
      styles.push("margin-right: auto");
    } else if (imageAlign === "left") {
      styles.push("float: left");
      styles.push("margin-right: 10px");
      styles.push("margin-bottom: 10px");
    } else if (imageAlign === "right") {
      styles.push("float: right");
      styles.push("margin-left: 10px");
      styles.push("margin-bottom: 10px");
    }

    // Border
    if (imageBorder !== "none") {
      const borderWidth =
        imageBorder === "thin"
          ? "1px"
          : imageBorder === "medium"
            ? "2px"
            : "3px";
      styles.push(`border: ${borderWidth} solid ${imageBorderColor}`);
    }

    // Shadow
    if (imageShadow !== "none") {
      const blur =
        imageShadow === "small"
          ? "4px"
          : imageShadow === "medium"
            ? "8px"
            : "16px";

      let shadowValue = "";
      if (imageShadowDirection === "all") {
        shadowValue = `0 0 ${blur}`;
      } else if (imageShadowDirection === "top") {
        shadowValue = `0 -${blur.replace("px", "") === "4" ? "2" : blur.replace("px", "") === "8" ? "4" : "8"}px ${blur}`;
      } else if (imageShadowDirection === "bottom") {
        shadowValue = `0 ${blur.replace("px", "") === "4" ? "2" : blur.replace("px", "") === "8" ? "4" : "8"}px ${blur}`;
      } else if (imageShadowDirection === "left") {
        shadowValue = `-${blur.replace("px", "") === "4" ? "2" : blur.replace("px", "") === "8" ? "4" : "8"}px 0 ${blur}`;
      } else if (imageShadowDirection === "right") {
        shadowValue = `${blur.replace("px", "") === "4" ? "2" : blur.replace("px", "") === "8" ? "4" : "8"}px 0 ${blur}`;
      }

      styles.push(`box-shadow: ${shadowValue} ${imageShadowColor}`);
    }

    // Border Radius
    if (imageBorderRadius !== "none") {
      let radiusValue = "";
      if (imageBorderRadius === "small") {
        radiusValue = "4px";
      } else if (imageBorderRadius === "medium") {
        radiusValue = "8px";
      } else if (imageBorderRadius === "large") {
        radiusValue = "16px";
      } else if (imageBorderRadius === "custom" && imageCustomBorderRadius) {
        radiusValue = imageCustomBorderRadius + "px";
      }
      if (radiusValue) {
        styles.push(`border-radius: ${radiusValue}`);
      }
    }

    // Apply styles
    imgElement.setAttribute("style", styles.join("; "));
  };

  const handleImageInsert = () => {
    if (quillRef.current && imageUrl) {
      const editor = quillRef.current.getEditor();

      if (isEditingImage) {
        // Editing mode: find and update the existing image
        setTimeout(() => {
          const imgElements = editor.root.querySelectorAll("img");
          const imgElement = Array.from(imgElements).find(
            (img) => (img as HTMLImageElement).src === imageUrl,
          ) as HTMLImageElement | undefined;

          if (imgElement) {
            applyImageStyles(imgElement);
          }
        }, 100);
      } else {
        // Insert mode: insert new image
        const selection = savedSelectionRef.current;
        let position = selection ? selection.index : editor.getLength();

        // If inserting at the very beginning (position 0), add an empty line first
        // This allows users to add content above the image later
        if (position === 0) {
          editor.insertText(0, "\n");
          position = 1; // Insert image after the empty line
        }

        // Insert a newline before image if not at the start and previous char is not newline
        if (position > 0) {
          const previousChar = editor.getText(position - 1, 1);
          if (previousChar !== "\n") {
            editor.insertText(position, "\n");
            editor.insertEmbed(position + 1, "image", imageUrl);
            // Insert one newline after image for easy editing
            editor.insertText(position + 2, "\n");
            // Set cursor position after the newline
            editor.setSelection(position + 3, 0);
          } else {
            editor.insertEmbed(position, "image", imageUrl);
            // Insert one newline after image
            editor.insertText(position + 1, "\n");
            editor.setSelection(position + 2, 0);
          }
        }

        // Apply style to the inserted image using setTimeout to ensure DOM is updated
        setTimeout(() => {
          const imgElements = editor.root.querySelectorAll("img");
          const imgElement = Array.from(imgElements).find(
            (img) => (img as HTMLImageElement).src === imageUrl,
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
              [{ font: fontList }], // Font selector
              [{ header: [1, 2, 3, false] }],
              [{ size: ["0.75em", false, "1.5em", "2.5em"] }], // Font size selector using em values for styles
              ["bold", "italic", "underline", "strike"],
              [{ color: [] }, { background: [] }],
              [{ list: "ordered" }, { list: "bullet" }],
              [{ align: [] }], // Text alignment
              ["link", "image", "video", "emoji"],
              ["clean"],
            ],
            handlers: {
              image: imageHandler,
              video: insertVideo,
              emoji: handleEmojiClick,
            },
          },
      clipboard: {
        matchVisual: false,
        matchers: [
          // Preserve image styles when copying/pasting
          [
            "IMG",
            (node: any, delta: any) => {
              const ops = delta.ops;
              if (
                ops &&
                ops.length > 0 &&
                ops[0].insert &&
                typeof ops[0].insert === "object" &&
                ops[0].insert.image
              ) {
                // Preserve style, alt, and data-image-metadata attributes
                const attributes: any = {};
                if (node.hasAttribute("style")) {
                  attributes.style = node.getAttribute("style");
                }
                if (node.hasAttribute("alt")) {
                  attributes.alt = node.getAttribute("alt");
                }
                if (node.hasAttribute("data-image-metadata")) {
                  attributes["data-image-metadata"] = node.getAttribute(
                    "data-image-metadata",
                  );
                }

                if (Object.keys(attributes).length > 0) {
                  ops[0].attributes = { ...ops[0].attributes, ...attributes };
                }
              }
              return delta;
            },
          ],
        ],
      },
      keyboard: {
        bindings: {
          // Handle delete key for custom embeds (video, image)
          delete: {
            key: "Delete",
            handler: function (this: any, range: any) {
              const editor = this.quill;
              if (range.length > 0) {
                // If there's a selection, delete it
                editor.deleteText(range.index, range.length, "user");
                return false; // Prevent default
              }
              return true; // Allow default behavior for single character delete
            },
          },
          // Handle backspace key for custom embeds
          backspace: {
            key: "Backspace",
            handler: function (this: any, range: any) {
              const editor = this.quill;
              if (range.length > 0) {
                // If there's a selection, delete it
                editor.deleteText(range.index, range.length, "user");
                return false; // Prevent default
              }
              return true; // Allow default behavior for single character backspace
            },
          },
        },
      },
    }),
    [readOnly],
  );

  // Quill formats
  const formats = [
    "font",
    "header",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "color",
    "background",
    "align",
    "link",
    "image",
    "video",
    "textEffect",
  ];

  // Add tooltips to toolbar buttons and setup emoji button icon
  useEffect(() => {
    if (!quillRef.current || readOnly) return;

    const toolbar = quillRef.current.getEditor().getModule("toolbar") as any;
    if (!toolbar || !toolbar.container) return;

    const container = toolbar.container as HTMLElement;

    // Tooltip mapping
    const tooltips: { [key: string]: string } = {
      ".ql-bold": t("richTextEditor.bold"),
      ".ql-italic": t("richTextEditor.italic"),
      ".ql-underline": t("richTextEditor.underline"),
      ".ql-strike": t("richTextEditor.strike"),
      '.ql-header[value="1"]': t("richTextEditor.header1"),
      '.ql-header[value="2"]': t("richTextEditor.header2"),
      '.ql-header[value="3"]': t("richTextEditor.header3"),
      ".ql-size": t("richTextEditor.size", "Size"),
      '.ql-list[value="ordered"]': t("richTextEditor.orderedList"),
      '.ql-list[value="bullet"]': t("richTextEditor.bulletList"),
      ".ql-color": t("richTextEditor.textColor"),
      ".ql-background": t("richTextEditor.backgroundColor"),
      ".ql-align": t("richTextEditor.align", "Align"),
      ".ql-link": t("richTextEditor.link"),
      ".ql-image": t("richTextEditor.image"),
      ".ql-video": t("richTextEditor.video"),
      ".ql-emoji": t("richTextEditor.emoji", "Emoji"),
      ".ql-pageBackground": t(
        "richTextEditor.pageBackground",
        "Page Background",
      ),
      ".ql-clean": t("richTextEditor.clean"),
      ".ql-font .ql-picker-label": t("richTextEditor.font", "Font"),
      ".ql-font .ql-picker-item": "", // No tooltip for items
    };

    // Apply tooltips
    Object.entries(tooltips).forEach(([selector, tooltip]) => {
      const button = container.querySelector(selector);
      if (button) {
        button.setAttribute("title", tooltip);
      }
    });

    // Also handle header dropdown
    const headerPicker = container.querySelector(".ql-header .ql-picker-label");
    if (headerPicker) {
      headerPicker.setAttribute("title", t("richTextEditor.header"));
    }

    // Add emoji icon to emoji button (it doesn't have a default icon)
    const emojiButton = container.querySelector(
      ".ql-emoji",
    ) as HTMLButtonElement;
    if (emojiButton && !emojiButton.innerHTML.includes("svg")) {
      // Use emoji smiley face SVG icon matching Quill's icon style
      emojiButton.innerHTML = `
        <svg viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="7" class="ql-stroke" fill="none" stroke-width="1"/>
          <circle cx="6" cy="7" r="1" class="ql-fill"/>
          <circle cx="12" cy="7" r="1" class="ql-fill"/>
          <path d="M5.5 11 Q9 14 12.5 11" class="ql-stroke" fill="none" stroke-width="1"/>
        </svg>
      `;
    }

    // Add page background icon (paint bucket)
    const pageBackgroundButton = container.querySelector(
      ".ql-pageBackground",
    ) as HTMLButtonElement;
    if (
      pageBackgroundButton &&
      !pageBackgroundButton.innerHTML.includes("svg")
    ) {
      pageBackgroundButton.innerHTML = `
        <svg viewBox="0 0 18 18">
          <rect x="2" y="2" width="14" height="14" rx="2" class="ql-stroke" fill="none" stroke-width="1"/>
          <rect x="4" y="10" width="10" height="4" class="ql-fill"/>
        </svg>
      `;
    }
  }, [t, readOnly]);

  // Handle font, size, and header picker to prevent selection loss
  useEffect(() => {
    if (!quillRef.current || readOnly) return;

    const editor = quillRef.current.getEditor();
    const toolbar = editor.getModule("toolbar") as any;
    if (!toolbar || !toolbar.container) return;

    const container = toolbar.container as HTMLElement;

    // Get all pickers that need selection preservation
    const fontPicker = container.querySelector(".ql-font");
    const sizePicker = container.querySelector(".ql-size");
    const headerPicker = container.querySelector(".ql-header");

    const cleanupFunctions: (() => void)[] = [];

    // Generic handler factory for picker clicks
    const createPickerHandlers = (
      picker: Element | null,
      formatName: string,
    ) => {
      if (!picker) return;

      const handleItemClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const pickerItem = target.closest(".ql-picker-item") as HTMLElement;

        if (pickerItem) {
          // If this is a font change, always save to localStorage
          if (formatName === "font") {
            const selectedValue = pickerItem.getAttribute("data-value");
            if (selectedValue) {
              localStorage.setItem(
                "richTextEditor.lastUsedFont",
                selectedValue,
              );
            }
          }

          // Save current selection before Quill processes the click
          const selection = savedSelectionRef.current;

          // Let Quill handle the format application naturally
          // We just need to restore the selection after Quill finishes
          if (selection && selection.length > 0) {
            // Use setTimeout to restore selection after Quill's native handler runs
            setTimeout(() => {
              editor.setSelection(selection.index, selection.length);
              editor.focus();
            }, 0);
          }
        }
      };

      // Prevent mousedown from stealing focus on the entire picker
      const handleMouseDown = (e: Event) => {
        const target = e.target as HTMLElement;
        // Prevent focus loss when clicking on picker label or options
        if (
          target.closest(".ql-picker-options") ||
          target.closest(".ql-picker-label")
        ) {
          e.preventDefault();
        }
      };

      picker.addEventListener("mousedown", handleMouseDown, true);
      picker.addEventListener("click", handleItemClick, true);

      cleanupFunctions.push(() => {
        picker.removeEventListener("mousedown", handleMouseDown, true);
        picker.removeEventListener("click", handleItemClick, true);
      });
    };

    // Setup handlers for each picker
    createPickerHandlers(fontPicker, "font");
    createPickerHandlers(sizePicker, "size");
    createPickerHandlers(headerPicker, "header");

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [readOnly]);

  // Create localized styles for the size picker
  const localizedSizeStyles = useMemo(
    () => `
    .ql-picker.ql-size .ql-picker-label::before, .ql-picker.ql-size .ql-picker-item::before { content: "${t("richTextEditor.sizeNormal", "Normal")}" !important; }
    .ql-picker.ql-size .ql-picker-label[data-value="0.75em"]::before, .ql-picker.ql-size .ql-picker-item[data-value="0.75em"]::before { content: "${t("richTextEditor.sizeSmall", "Small")}" !important; }
    .ql-picker.ql-size .ql-picker-label[data-value="1.5em"]::before, .ql-picker.ql-size .ql-picker-item[data-value="1.5em"]::before { content: "${t("richTextEditor.sizeLarge", "Large")}" !important; }
    .ql-picker.ql-size .ql-picker-label[data-value="2.5em"]::before, .ql-picker.ql-size .ql-picker-item[data-value="2.5em"]::before { content: "${t("richTextEditor.sizeHuge", "Huge")}" !important; }
  `,
    [t],
  );

  // CSS keyframes for animation effects (works in webviews)
  const animationKeyframes = `
    @keyframes ql-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes ql-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes ql-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }
    @keyframes ql-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes ql-glow-pulse {
      0%, 100% { text-shadow: 0 0 5px currentColor, 0 0 10px currentColor; }
      50% { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
    }
    @keyframes ql-rainbow {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    @keyframes ql-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes ql-jelly {
      0%, 100% { transform: scale(1, 1); }
      25% { transform: scale(0.95, 1.05); }
      50% { transform: scale(1.05, 0.95); }
      75% { transform: scale(0.95, 1.05); }
    }
    @keyframes ql-swing {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(5deg); }
      75% { transform: rotate(-5deg); }
    }
    @keyframes ql-heartbeat {
      0%, 100% { transform: scale(1); }
      14% { transform: scale(1.15); }
      28% { transform: scale(1); }
      42% { transform: scale(1.15); }
      70% { transform: scale(1); }
    }
  `;

  return (
    <Box sx={{ position: "relative" }}>
      <style>{localizedSizeStyles}</style>
      <style>{animationKeyframes}</style>
      <Paper
        variant="outlined"
        sx={{
          overflow: "visible", // Changed from 'hidden' to allow tooltip to show
          borderRadius: 2,
          border: "none",
          "& .quill": {
            display: "flex",
            flexDirection: "column",
            height: "100%",
          },
          "& .ql-toolbar": {
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottom: `1px dashed ${theme.palette.divider}`,
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.02)"
                : "rgba(0, 0, 0, 0.01)",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          },
          "& .ql-container": {
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottom: "none",
            fontSize: "14px",
            fontFamily: theme.typography.fontFamily,
            minHeight: `${minHeight}px`,
            overflow: "visible", // Allow tooltip to overflow
          },
          "& .ql-editor": {
            minHeight: `${minHeight}px`,
            color: theme.palette.text.primary,
            "&.ql-blank::before": {
              color: theme.palette.text.secondary,
              fontStyle: "normal",
            },
            // Image styling
            "& img": {
              maxWidth: "100%",
              height: "auto",
              display: "inline-block",
              verticalAlign: "middle",
            },
          },
          "& .ql-stroke": {
            stroke: theme.palette.text.primary,
          },
          "& .ql-fill": {
            fill: theme.palette.text.primary,
          },
          "& .ql-picker-label": {
            color: theme.palette.text.primary,
          },
          "& .ql-picker-options": {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            zIndex: 9999,
            position: "absolute",
          },
          // Font picker specific styling
          "& .ql-font.ql-picker": {
            "& .ql-picker-label": {
              maxWidth: "100px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "inline-block",
            },
            "& .ql-picker-options": {
              zIndex: 99999,
              maxHeight: "200px",
              overflowY: "auto",
            },
          },
          "& .ql-toolbar button:hover, & .ql-toolbar button:focus": {
            color: theme.palette.primary.main,
            "& .ql-stroke": {
              stroke: theme.palette.primary.main,
            },
            "& .ql-fill": {
              fill: theme.palette.primary.main,
            },
          },
          "& .ql-toolbar button.ql-active": {
            color: theme.palette.primary.main,
            "& .ql-stroke": {
              stroke: theme.palette.primary.main,
            },
            "& .ql-fill": {
              fill: theme.palette.primary.main,
            },
          },
          // Link tooltip positioning
          "& .ql-tooltip": {
            position: "absolute",
            zIndex: 9999,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[4],
            color: theme.palette.text.primary,
            padding: "8px 12px",
            borderRadius: "4px",
            left: "0 !important", // Override default positioning
            transform: "translateY(10px)", // Position below the selection
            '& input[type="text"]': {
              backgroundColor: theme.palette.background.default,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              padding: "6px 8px",
              borderRadius: "4px",
              "&:focus": {
                outline: "none",
                borderColor: theme.palette.primary.main,
              },
            },
            "& a.ql-action::after": {
              content: '"Edit"',
              color: theme.palette.primary.main,
            },
            "& a.ql-remove::before": {
              content: '"Remove"',
              color: theme.palette.error.main,
            },
          },
          "& .ql-tooltip.ql-editing": {
            left: "0 !important",
          },
        }}
      >
        <Box onContextMenu={handleContextMenu} sx={{ position: "relative" }}>
          {/* Floating Toolbar for text selection - using Portal to avoid clipping */}
          {floatingToolbar.visible && (
            <Portal>
              <Paper
                ref={floatingToolbarRef}
                elevation={4}
                sx={{
                  position: "fixed",
                  top: floatingToolbar.top,
                  left: floatingToolbar.left,
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  p: 0.5,
                  borderRadius: 1,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                }}
                onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
              >
                {/* Font selector */}
                <Select
                  size="small"
                  value=""
                  displayEmpty
                  open={floatingFontOpen}
                  onOpen={() => {
                    setFloatingSizeOpen(false);
                    setFloatingEffectOpen(false);
                    setFloatingFontOpen(true);
                  }}
                  onClose={() => setFloatingFontOpen(false)}
                  onChange={(e) => {
                    if (quillRef.current && e.target.value) {
                      const editor = quillRef.current.getEditor();
                      const selection = savedSelectionRef.current;
                      if (selection && selection.length > 0) {
                        editor.formatText(
                          selection.index,
                          selection.length,
                          "font",
                          e.target.value,
                        );
                        // Save as last used font
                        localStorage.setItem(
                          "richTextEditor.lastUsedFont",
                          e.target.value,
                        );
                      }
                    }
                    setFloatingFontOpen(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  MenuProps={{
                    anchorOrigin: { vertical: "top", horizontal: "left" },
                    transformOrigin: { vertical: "bottom", horizontal: "left" },
                    PaperProps: { sx: { maxHeight: 300, mb: 1 } },
                    container: floatingToolbarRef.current,
                  }}
                  sx={{
                    minWidth: 100,
                    height: 28,
                    "& .MuiSelect-select": { py: 0.5, fontSize: "0.75rem" },
                  }}
                  title={t("richTextEditor.font")}
                  renderValue={() => (
                    <SizeIcon fontSize="small" sx={{ mt: 0.5 }} />
                  )}
                >
                  {fontList.map((font) => (
                    <MenuItem
                      key={font}
                      value={font}
                      sx={{ fontFamily: font, fontSize: "0.85rem" }}
                    >
                      {font}
                    </MenuItem>
                  ))}
                </Select>

                {/* Size selector */}
                <Select
                  size="small"
                  value=""
                  displayEmpty
                  open={floatingSizeOpen}
                  onOpen={() => {
                    setFloatingFontOpen(false);
                    setFloatingEffectOpen(false);
                    setFloatingSizeOpen(true);
                  }}
                  onClose={() => setFloatingSizeOpen(false)}
                  onChange={(e) => {
                    if (quillRef.current && e.target.value !== undefined) {
                      const editor = quillRef.current.getEditor();
                      const selection = savedSelectionRef.current;
                      if (selection && selection.length > 0) {
                        editor.formatText(
                          selection.index,
                          selection.length,
                          "size",
                          e.target.value || false,
                        );
                      }
                    }
                    setFloatingSizeOpen(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  MenuProps={{
                    anchorOrigin: { vertical: "top", horizontal: "left" },
                    transformOrigin: { vertical: "bottom", horizontal: "left" },
                    PaperProps: { sx: { mb: 1 } },
                    container: floatingToolbarRef.current,
                  }}
                  sx={{
                    minWidth: 70,
                    height: 28,
                    "& .MuiSelect-select": { py: 0.5, fontSize: "0.75rem" },
                  }}
                  title={t("richTextEditor.size")}
                  renderValue={() => t("richTextEditor.size")}
                >
                  <MenuItem value="">{t("richTextEditor.sizeNormal")}</MenuItem>
                  <MenuItem value="0.75em">
                    {t("richTextEditor.sizeSmall")}
                  </MenuItem>
                  <MenuItem value="1.5em">
                    {t("richTextEditor.sizeLarge")}
                  </MenuItem>
                  <MenuItem value="2.5em">
                    {t("richTextEditor.sizeHuge")}
                  </MenuItem>
                </Select>

                {/* Text effect selector */}
                <Select
                  size="small"
                  value=""
                  displayEmpty
                  open={floatingEffectOpen}
                  onOpen={() => {
                    setFloatingFontOpen(false);
                    setFloatingSizeOpen(false);
                    setFloatingEffectOpen(true);
                  }}
                  onClose={() => setFloatingEffectOpen(false)}
                  onChange={(e) => {
                    if (quillRef.current && e.target.value) {
                      const editor = quillRef.current.getEditor();
                      const selection = savedSelectionRef.current;
                      if (selection && selection.length > 0) {
                        // Apply effect (including 'none' which resets styling)
                        editor.formatText(
                          selection.index,
                          selection.length,
                          "textEffect",
                          e.target.value,
                        );
                      }
                    }
                    setFloatingEffectOpen(false);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  MenuProps={{
                    anchorOrigin: { vertical: "top", horizontal: "left" },
                    transformOrigin: { vertical: "bottom", horizontal: "left" },
                    PaperProps: { sx: { maxHeight: 300, mb: 1 } },
                    container: floatingToolbarRef.current,
                  }}
                  sx={{
                    minWidth: 70,
                    height: 28,
                    "& .MuiSelect-select": { py: 0.5, fontSize: "0.75rem" },
                  }}
                  title={t("richTextEditor.effect", "Effect")}
                  renderValue={() => t("richTextEditor.effect", "Effect")}
                >
                  <MenuItem value="none">
                    <em>{t("richTextEditor.effectNone", "None")}</em>
                  </MenuItem>
                  {/* Shadow Effects */}
                  <MenuItem
                    value="shadow"
                    sx={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}
                  >
                    {t("richTextEditor.effectShadow", "Shadow")}
                  </MenuItem>
                  <MenuItem
                    value="shadow-light"
                    sx={{ textShadow: "1px 1px 2px rgba(0,0,0,0.3)" }}
                  >
                    {t("richTextEditor.effectShadowLight", "Light Shadow")}
                  </MenuItem>
                  <MenuItem
                    value="shadow-hard"
                    sx={{ textShadow: "3px 3px 0 rgba(0,0,0,0.8)" }}
                  >
                    {t("richTextEditor.effectShadowHard", "Hard Shadow")}
                  </MenuItem>
                  {/* Glow Effects */}
                  <MenuItem
                    value="glow"
                    sx={{ textShadow: "0 0 10px currentColor" }}
                  >
                    {t("richTextEditor.effectGlow", "Glow")}
                  </MenuItem>
                  <MenuItem
                    value="glow-blue"
                    sx={{ textShadow: "0 0 10px #00bfff, 0 0 20px #00bfff" }}
                  >
                    {t("richTextEditor.effectGlowBlue", "Blue Glow")}
                  </MenuItem>
                  <MenuItem
                    value="glow-gold"
                    sx={{ textShadow: "0 0 10px #ffd700, 0 0 20px #ffd700" }}
                  >
                    {t("richTextEditor.effectGlowGold", "Gold Glow")}
                  </MenuItem>
                  <MenuItem
                    value="glow-red"
                    sx={{ textShadow: "0 0 10px #ff4444, 0 0 20px #ff4444" }}
                  >
                    {t("richTextEditor.effectGlowRed", "Red Glow")}
                  </MenuItem>
                  <MenuItem
                    value="glow-green"
                    sx={{ textShadow: "0 0 10px #00ff88, 0 0 20px #00ff88" }}
                  >
                    {t("richTextEditor.effectGlowGreen", "Green Glow")}
                  </MenuItem>
                  <MenuItem
                    value="glow-purple"
                    sx={{ textShadow: "0 0 10px #a855f7, 0 0 20px #a855f7" }}
                  >
                    {t("richTextEditor.effectGlowPurple", "Purple Glow")}
                  </MenuItem>
                  {/* Outline Effects */}
                  <MenuItem
                    value="outline"
                    sx={{ WebkitTextStroke: "1px currentColor" }}
                  >
                    {t("richTextEditor.effectOutline", "Outline")}
                  </MenuItem>
                  <MenuItem
                    value="outline-white"
                    sx={{ WebkitTextStroke: "1px white", color: "black" }}
                  >
                    {t("richTextEditor.effectOutlineWhite", "White Outline")}
                  </MenuItem>
                  <MenuItem
                    value="outline-black"
                    sx={{ WebkitTextStroke: "1px black" }}
                  >
                    {t("richTextEditor.effectOutlineBlack", "Black Outline")}
                  </MenuItem>
                  {/* 3D Effects */}
                  <MenuItem
                    value="emboss"
                    sx={{
                      textShadow:
                        "-1px -1px 0 rgba(255,255,255,0.5), 1px 1px 0 rgba(0,0,0,0.5)",
                    }}
                  >
                    {t("richTextEditor.effectEmboss", "Emboss")}
                  </MenuItem>
                  <MenuItem
                    value="engrave"
                    sx={{
                      textShadow:
                        "1px 1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(0,0,0,0.5)",
                    }}
                  >
                    {t("richTextEditor.effectEngrave", "Engrave")}
                  </MenuItem>
                  <MenuItem
                    value="3d"
                    sx={{
                      textShadow: "0 1px 0 #ccc, 0 2px 0 #c9c9c9, 0 3px 0 #bbb",
                    }}
                  >
                    {t("richTextEditor.effect3D", "3D")}
                  </MenuItem>
                  <MenuItem
                    value="retro"
                    sx={{ textShadow: "3px 3px 0 #f0f, 6px 6px 0 #0ff" }}
                  >
                    {t("richTextEditor.effectRetro", "Retro")}
                  </MenuItem>
                  {/* Neon Effects */}
                  <MenuItem
                    value="neon"
                    sx={{
                      textShadow:
                        "0 0 5px #fff, 0 0 10px #fff, 0 0 15px #ff00de",
                    }}
                  >
                    {t("richTextEditor.effectNeon", "Neon")}
                  </MenuItem>
                  <MenuItem
                    value="neon-cyan"
                    sx={{
                      textShadow:
                        "0 0 5px #fff, 0 0 10px #fff, 0 0 15px #00ffff",
                    }}
                  >
                    {t("richTextEditor.effectNeonCyan", "Cyan Neon")}
                  </MenuItem>
                  <MenuItem
                    value="neon-orange"
                    sx={{
                      textShadow:
                        "0 0 5px #fff, 0 0 10px #fff, 0 0 15px #ff6b00",
                    }}
                  >
                    {t("richTextEditor.effectNeonOrange", "Orange Neon")}
                  </MenuItem>
                  {/* Gradient Effects */}
                  <MenuItem
                    value="gradient-rainbow"
                    sx={{
                      background:
                        "linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t("richTextEditor.effectGradientRainbow", "Rainbow")}
                  </MenuItem>
                  <MenuItem
                    value="gradient-gold"
                    sx={{
                      background:
                        "linear-gradient(180deg, #ffd700, #ffb700, #ff9500)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t("richTextEditor.effectGradientGold", "Gold Gradient")}
                  </MenuItem>
                  <MenuItem
                    value="gradient-silver"
                    sx={{
                      background:
                        "linear-gradient(180deg, #e8e8e8, #bbb, #888)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t(
                      "richTextEditor.effectGradientSilver",
                      "Silver Gradient",
                    )}
                  </MenuItem>
                  <MenuItem
                    value="gradient-fire"
                    sx={{
                      background:
                        "linear-gradient(180deg, #ff0000, #ff6600, #ffcc00)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t("richTextEditor.effectGradientFire", "Fire Gradient")}
                  </MenuItem>
                  <MenuItem
                    value="gradient-ice"
                    sx={{
                      background:
                        "linear-gradient(180deg, #00bfff, #87ceeb, #e0ffff)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t("richTextEditor.effectGradientIce", "Ice Gradient")}
                  </MenuItem>
                  <MenuItem
                    value="gradient-sunset"
                    sx={{
                      background: "linear-gradient(90deg, #ff512f, #dd2476)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t(
                      "richTextEditor.effectGradientSunset",
                      "Sunset Gradient",
                    )}
                  </MenuItem>
                  {/* Animation Effects */}
                  <MenuItem
                    value="anim-blink"
                    sx={{ animation: "ql-blink 1s step-end infinite" }}
                  >
                    {t("richTextEditor.effectAnimBlink", "Blink")}
                  </MenuItem>
                  <MenuItem
                    value="anim-pulse"
                    sx={{ animation: "ql-pulse 1.5s ease-in-out infinite" }}
                  >
                    {t("richTextEditor.effectAnimPulse", "Pulse")}
                  </MenuItem>
                  <MenuItem
                    value="anim-shake"
                    sx={{
                      animation: "ql-shake 0.5s ease-in-out infinite",
                      display: "inline-block",
                    }}
                  >
                    {t("richTextEditor.effectAnimShake", "Shake")}
                  </MenuItem>
                  <MenuItem
                    value="anim-bounce"
                    sx={{
                      animation: "ql-bounce 0.6s ease infinite",
                      display: "inline-block",
                    }}
                  >
                    {t("richTextEditor.effectAnimBounce", "Bounce")}
                  </MenuItem>
                  <MenuItem
                    value="anim-glow-pulse"
                    sx={{
                      animation: "ql-glow-pulse 1.5s ease-in-out infinite",
                    }}
                  >
                    {t("richTextEditor.effectAnimGlowPulse", "Glow Pulse")}
                  </MenuItem>
                  <MenuItem
                    value="anim-float"
                    sx={{
                      animation: "ql-float 2s ease-in-out infinite",
                      display: "inline-block",
                    }}
                  >
                    {t("richTextEditor.effectAnimFloat", "Float")}
                  </MenuItem>
                  <MenuItem
                    value="anim-jelly"
                    sx={{
                      animation: "ql-jelly 0.8s ease infinite",
                      display: "inline-block",
                    }}
                  >
                    {t("richTextEditor.effectAnimJelly", "Jelly")}
                  </MenuItem>
                  <MenuItem
                    value="anim-swing"
                    sx={{
                      animation: "ql-swing 1s ease-in-out infinite",
                      display: "inline-block",
                    }}
                  >
                    {t("richTextEditor.effectAnimSwing", "Swing")}
                  </MenuItem>
                  <MenuItem
                    value="anim-heartbeat"
                    sx={{
                      animation: "ql-heartbeat 1.2s ease-in-out infinite",
                      display: "inline-block",
                    }}
                  >
                    {t("richTextEditor.effectAnimHeartbeat", "Heartbeat")}
                  </MenuItem>
                  <MenuItem
                    value="anim-rainbow"
                    sx={{
                      background:
                        "linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0000)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundSize: "200% auto",
                      animation: "ql-rainbow 3s linear infinite",
                    }}
                  >
                    {t("richTextEditor.effectAnimRainbow", "Rainbow Wave")}
                  </MenuItem>
                </Select>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Formatting buttons */}
                <IconButton
                  size="small"
                  onClick={formatBold}
                  title={t("richTextEditor.bold")}
                  sx={{ padding: "4px" }}
                >
                  <BoldIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={formatItalic}
                  title={t("richTextEditor.italic")}
                  sx={{ padding: "4px" }}
                >
                  <ItalicIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={formatUnderline}
                  title={t("richTextEditor.underline")}
                  sx={{ padding: "4px" }}
                >
                  <UnderlineIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={formatStrikethrough}
                  title={t("richTextEditor.strike")}
                  sx={{ padding: "4px" }}
                >
                  <StrikethroughIcon fontSize="small" />
                </IconButton>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Clipboard buttons */}
                <IconButton
                  size="small"
                  onClick={handleCut}
                  title={t("common.cut", "Cut")}
                  sx={{ padding: "4px" }}
                >
                  <CutIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  title={t("common.copy", "Copy")}
                  sx={{ padding: "4px" }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handlePaste}
                  title={t("common.paste", "Paste")}
                  sx={{ padding: "4px" }}
                >
                  <PasteIcon fontSize="small" />
                </IconButton>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Clear formatting */}
                <IconButton
                  size="small"
                  onClick={clearFormatting}
                  title={t("richTextEditor.clearFormatting")}
                  sx={{ padding: "4px" }}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Paper>
            </Portal>
          )}

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

      {/* Emoji Picker Popover */}
      <Popover
        open={emojiOpen}
        anchorEl={emojiPosition ? undefined : emojiAnchorEl}
        anchorReference={emojiPosition ? "anchorPosition" : "anchorEl"}
        anchorPosition={
          emojiPosition
            ? { top: emojiPosition.top, left: emojiPosition.left }
            : undefined
        }
        onClose={handleEmojiClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        // Hide the backdrop completely
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={handleEmojiClose}>
          <Box>
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              theme={
                theme.palette.mode === "dark"
                  ? EmojiTheme.DARK
                  : EmojiTheme.LIGHT
              }
              width={350}
              height={400}
              searchPlaceholder={t(
                "richTextEditor.emojiSearch",
                "Search emoji...",
              )}
              previewConfig={{
                showPreview: false,
              }}
              categories={[
                {
                  category: Categories.SUGGESTED,
                  name: t(
                    "richTextEditor.emojiFrequentlyUsed",
                    "Frequently Used",
                  ),
                },
                {
                  category: Categories.SMILEYS_PEOPLE,
                  name: t(
                    "richTextEditor.emojiSmileysAndPeople",
                    "Smileys & People",
                  ),
                },
                {
                  category: Categories.ANIMALS_NATURE,
                  name: t(
                    "richTextEditor.emojiAnimalsAndNature",
                    "Animals & Nature",
                  ),
                },
                {
                  category: Categories.FOOD_DRINK,
                  name: t("richTextEditor.emojiFoodAndDrink", "Food & Drink"),
                },
                {
                  category: Categories.TRAVEL_PLACES,
                  name: t(
                    "richTextEditor.emojiTravelAndPlaces",
                    "Travel & Places",
                  ),
                },
                {
                  category: Categories.ACTIVITIES,
                  name: t("richTextEditor.emojiActivities", "Activities"),
                },
                {
                  category: Categories.OBJECTS,
                  name: t("richTextEditor.emojiObjects", "Objects"),
                },
                {
                  category: Categories.SYMBOLS,
                  name: t("richTextEditor.emojiSymbols", "Symbols"),
                },
                {
                  category: Categories.FLAGS,
                  name: t("richTextEditor.emojiFlags", "Flags"),
                },
              ]}
            />
          </Box>
        </ClickAwayListener>
      </Popover>

      {/* Dynamic styles for font picker */}
      <style>
        {`
          ${fontList
            .map(
              (font) => `
            .ql-snow .ql-picker.ql-font .ql-picker-label[data-value="${font}"]::before,
            .ql-snow .ql-picker.ql-font .ql-picker-item[data-value="${font}"]::before {
              content: "${font}";
              font-family: "${font}";
            }
          `,
            )
            .join("")}
        `}
      </style>

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
        <MenuItem
          onClick={() => {
            handleContextMenuClose();
            handleCut();
          }}
        >
          <ListItemIcon>
            <CutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("common.cut", "Cut")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleContextMenuClose();
            handleCopy();
          }}
        >
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("common.copy", "Copy")}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleContextMenuClose();
            handlePaste();
          }}
        >
          <ListItemIcon>
            <PasteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("common.paste", "Paste")}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={insertEmoji}>
          <ListItemIcon>
            <EmojiIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("richTextEditor.insertEmoji", "Insert Emoji")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={insertLink}>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("richTextEditor.insertLink", "Insert Link")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={insertImage}>
          <ListItemIcon>
            <ImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("richTextEditor.insertImage", "Insert Image")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={insertVideo}>
          <ListItemIcon>
            <VideoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("richTextEditor.insertVideo", "Insert Video")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={formatBold}>
          <ListItemIcon>
            <BoldIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("richTextEditor.bold", "Bold")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={formatItalic}>
          <ListItemIcon>
            <ItalicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("richTextEditor.italic", "Italic")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={formatUnderline}>
          <ListItemIcon>
            <UnderlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("richTextEditor.underline", "Underline")}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={clearFormatting}>
          <ListItemIcon>
            <ClearIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t("richTextEditor.clearFormatting", "Clear Formatting")}
          </ListItemText>
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
          <ListItemText>{t("richTextEditor.imageEdit")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleCopyImage}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("richTextEditor.imageCopy")}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteImage}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("richTextEditor.imageDelete")}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Link Insert Dialog */}
      <Dialog
        open={linkDialogOpen}
        onClose={handleLinkDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("richTextEditor.insertLink", "Insert Link")}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              label={t("richTextEditor.linkUrl", "URL")}
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              fullWidth
              required
              helperText={t(
                "richTextEditor.linkUrlHelp",
                "Enter the web address (URL)",
              )}
              onKeyPress={(e) => {
                if (e.key === "Enter" && linkUrl) {
                  handleLinkInsert();
                }
              }}
            />
            <TextField
              label={t("richTextEditor.linkText", "Display Text (Optional)")}
              placeholder={t(
                "richTextEditor.linkTextPlaceholder",
                "Text to display",
              )}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              fullWidth
              helperText={t(
                "richTextEditor.linkTextHelp",
                "Leave empty to use URL as text",
              )}
              disabled={
                savedSelectionRef.current &&
                savedSelectionRef.current.length > 0
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLinkDialogClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleLinkInsert}
            variant="contained"
            disabled={!linkUrl}
          >
            {t("common.insert", "Insert")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Insert Dialog */}
      <Dialog
        open={imageDialogOpen}
        onClose={handleImageDialogClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {isEditingImage
            ? t("richTextEditor.imageEdit")
            : t("richTextEditor.insertImage")}
        </DialogTitle>
        <DialogContent sx={{ height: "70vh", p: 0, overflow: "hidden" }}>
          <Box sx={{ display: "flex", height: "100%" }}>
            {/* Left Panel: Settings */}
            <Box
              sx={{
                width: "50%",
                height: "100%",
                overflow: "auto",
                p: 3,
                borderRight: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {/* Image Source Group */}
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    {t("richTextEditor.imageSource")}
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    {/* Image URL */}
                    <TextField
                      autoFocus
                      label={t("richTextEditor.imageUrl")}
                      placeholder="https://example.com/image.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      fullWidth
                      required
                      error={imageUrlValid === false}
                      helperText={
                        imageUrlValidating
                          ? t("richTextEditor.imageUrlValidating")
                          : imageUrlValid === false
                            ? t("richTextEditor.imageUrlInvalid")
                            : imageUrlValid === true && imageOriginalSize
                              ? `${t("richTextEditor.imageOriginalSize")}: ${imageOriginalSize.width} × ${imageOriginalSize.height}`
                              : t("richTextEditor.imageUrlHelp")
                      }
                      onKeyPress={(e) => {
                        if (
                          e.key === "Enter" &&
                          imageUrl &&
                          imageUrlValid === true
                        ) {
                          handleImageInsert();
                        }
                      }}
                    />

                    {/* Alt Text */}
                    <TextField
                      label={t("richTextEditor.imageAltText")}
                      placeholder={t("richTextEditor.imageAltTextPlaceholder")}
                      value={imageAltText}
                      onChange={(e) => setImageAltText(e.target.value)}
                      fullWidth
                      helperText={t("richTextEditor.imageAltTextHelp")}
                    />
                  </Box>
                </Paper>

                {/* Advanced Options Accordion */}
                <Accordion
                  expanded={advancedOptionsExpanded}
                  onChange={handleAdvancedOptionsChange}
                  sx={{
                    "&:before": { display: "none" },
                    boxShadow: "none",
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t("richTextEditor.imageAdvancedOptions")}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2.5,
                      }}
                    >
                      {/* Width Selection and Aspect Ratio */}
                      <Box
                        sx={{ display: "flex", gap: 2, alignItems: "center" }}
                      >
                        <FormControl fullWidth>
                          <InputLabel>
                            {t("richTextEditor.imageWidth")}
                          </InputLabel>
                          <Select
                            value={imageWidth}
                            label={t("richTextEditor.imageWidth")}
                            onChange={(e) =>
                              setImageWidth(e.target.value as any)
                            }
                          >
                            <MenuItem value="original">
                              {t("richTextEditor.imageWidthOriginal")}
                            </MenuItem>
                            <MenuItem value="25">
                              {t("richTextEditor.imageWidth25")}
                            </MenuItem>
                            <MenuItem value="50">
                              {t("richTextEditor.imageWidth50")}
                            </MenuItem>
                            <MenuItem value="75">
                              {t("richTextEditor.imageWidth75")}
                            </MenuItem>
                            <MenuItem value="100">
                              {t("richTextEditor.imageWidth100")}
                            </MenuItem>
                            <MenuItem value="custom">
                              {t("richTextEditor.imageWidthCustom")}
                            </MenuItem>
                          </Select>
                        </FormControl>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={imageAspectRatio}
                              onChange={(e) =>
                                setImageAspectRatio(e.target.checked)
                              }
                            />
                          }
                          label={t("richTextEditor.imageAspectRatio")}
                          sx={{ whiteSpace: "nowrap" }}
                        />
                      </Box>

                      {/* Custom Width Input */}
                      {imageWidth === "custom" && (
                        <TextField
                          label={t("richTextEditor.imageWidthCustom")}
                          placeholder={t(
                            "richTextEditor.imageWidthCustomPlaceholder",
                          )}
                          value={imageCustomWidth}
                          onChange={(e) =>
                            setImageCustomWidth(
                              e.target.value.replace(/[^0-9]/g, ""),
                            )
                          }
                          fullWidth
                          helperText={t("richTextEditor.imageWidthCustomHelp")}
                          type="number"
                        />
                      )}

                      {/* Alignment */}
                      <FormControl component="fieldset">
                        <FormLabel component="legend">
                          {t("richTextEditor.imageAlign")}
                        </FormLabel>
                        <RadioGroup
                          row
                          value={imageAlign}
                          onChange={(e) => setImageAlign(e.target.value as any)}
                        >
                          <FormControlLabel
                            value="left"
                            control={<Radio />}
                            label={t("richTextEditor.imageAlignLeft")}
                          />
                          <FormControlLabel
                            value="center"
                            control={<Radio />}
                            label={t("richTextEditor.imageAlignCenter")}
                          />
                          <FormControlLabel
                            value="right"
                            control={<Radio />}
                            label={t("richTextEditor.imageAlignRight")}
                          />
                        </RadioGroup>
                      </FormControl>

                      {/* Border Selection and Color - One Line */}
                      <Box
                        sx={{
                          display: "flex",
                          gap: 2,
                          alignItems: "flex-start",
                        }}
                      >
                        <FormControl sx={{ flex: 1 }}>
                          <InputLabel>
                            {t("richTextEditor.imageBorder")}
                          </InputLabel>
                          <Select
                            value={imageBorder}
                            label={t("richTextEditor.imageBorder")}
                            onChange={(e) =>
                              setImageBorder(e.target.value as any)
                            }
                          >
                            <MenuItem value="none">
                              {t("richTextEditor.imageBorderNone")}
                            </MenuItem>
                            <MenuItem value="thin">
                              {t("richTextEditor.imageBorderThin")}
                            </MenuItem>
                            <MenuItem value="medium">
                              {t("richTextEditor.imageBorderMedium")}
                            </MenuItem>
                            <MenuItem value="thick">
                              {t("richTextEditor.imageBorderThick")}
                            </MenuItem>
                          </Select>
                        </FormControl>

                        {/* Border Color (conditional, same line) */}
                        {imageBorder !== "none" && (
                          <Box
                            sx={{
                              display: "flex",
                              gap: 1,
                              alignItems: "center",
                              flex: 1,
                            }}
                          >
                            <TextField
                              label={t("richTextEditor.imageBorderColor")}
                              value={imageBorderColor}
                              onChange={(e) =>
                                setImageBorderColor(e.target.value)
                              }
                              fullWidth
                              placeholder="#cccccc"
                            />
                            <Box
                              component="input"
                              type="color"
                              value={imageBorderColor}
                              onChange={(e) =>
                                setImageBorderColor(
                                  (e.target as HTMLInputElement).value,
                                )
                              }
                              sx={{
                                width: 60,
                                height: 40,
                                border: "none",
                                borderRadius: 1,
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            />
                          </Box>
                        )}
                      </Box>

                      {/* Border Radius - One Line with Custom Input */}
                      <Box
                        sx={{
                          display: "flex",
                          gap: 2,
                          alignItems: "flex-start",
                        }}
                      >
                        <FormControl sx={{ flex: 1 }}>
                          <InputLabel>
                            {t("richTextEditor.imageBorderRadius")}
                          </InputLabel>
                          <Select
                            value={imageBorderRadius}
                            label={t("richTextEditor.imageBorderRadius")}
                            onChange={(e) =>
                              setImageBorderRadius(e.target.value as any)
                            }
                          >
                            <MenuItem value="none">
                              {t("richTextEditor.imageBorderRadiusNone")}
                            </MenuItem>
                            <MenuItem value="small">
                              {t("richTextEditor.imageBorderRadiusSmall")}
                            </MenuItem>
                            <MenuItem value="medium">
                              {t("richTextEditor.imageBorderRadiusMedium")}
                            </MenuItem>
                            <MenuItem value="large">
                              {t("richTextEditor.imageBorderRadiusLarge")}
                            </MenuItem>
                            <MenuItem value="custom">
                              {t("richTextEditor.imageBorderRadiusCustom")}
                            </MenuItem>
                          </Select>
                        </FormControl>

                        {/* Custom Border Radius Input (conditional, same line) */}
                        {imageBorderRadius === "custom" && (
                          <TextField
                            label={t("richTextEditor.imageCustomBorderRadius")}
                            type="number"
                            value={imageCustomBorderRadius}
                            onChange={(e) =>
                              setImageCustomBorderRadius(e.target.value)
                            }
                            sx={{ flex: 1 }}
                            placeholder="8"
                            inputProps={{ min: 0 }}
                          />
                        )}
                      </Box>

                      {/* Shadow Selection and Direction - One Line */}
                      <Box
                        sx={{
                          display: "flex",
                          gap: 2,
                          alignItems: "flex-start",
                        }}
                      >
                        <FormControl sx={{ flex: 1 }}>
                          <InputLabel>
                            {t("richTextEditor.imageShadow")}
                          </InputLabel>
                          <Select
                            value={imageShadow}
                            label={t("richTextEditor.imageShadow")}
                            onChange={(e) =>
                              setImageShadow(e.target.value as any)
                            }
                          >
                            <MenuItem value="none">
                              {t("richTextEditor.imageShadowNone")}
                            </MenuItem>
                            <MenuItem value="small">
                              {t("richTextEditor.imageShadowSmall")}
                            </MenuItem>
                            <MenuItem value="medium">
                              {t("richTextEditor.imageShadowMedium")}
                            </MenuItem>
                            <MenuItem value="large">
                              {t("richTextEditor.imageShadowLarge")}
                            </MenuItem>
                          </Select>
                        </FormControl>

                        {/* Shadow Direction (conditional, same line) */}
                        {imageShadow !== "none" && (
                          <FormControl sx={{ flex: 1 }}>
                            <InputLabel>
                              {t("richTextEditor.imageShadowDirection")}
                            </InputLabel>
                            <Select
                              value={imageShadowDirection}
                              label={t("richTextEditor.imageShadowDirection")}
                              onChange={(e) =>
                                setImageShadowDirection(e.target.value as any)
                              }
                            >
                              <MenuItem value="all">
                                {t("richTextEditor.imageShadowDirectionAll")}
                              </MenuItem>
                              <MenuItem value="top">
                                {t("richTextEditor.imageShadowDirectionTop")}
                              </MenuItem>
                              <MenuItem value="bottom">
                                {t("richTextEditor.imageShadowDirectionBottom")}
                              </MenuItem>
                              <MenuItem value="left">
                                {t("richTextEditor.imageShadowDirectionLeft")}
                              </MenuItem>
                              <MenuItem value="right">
                                {t("richTextEditor.imageShadowDirectionRight")}
                              </MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      </Box>

                      {/* Shadow Color (conditional, separate line) */}
                      {imageShadow !== "none" && (
                        <Box
                          sx={{ display: "flex", gap: 1, alignItems: "center" }}
                        >
                          <TextField
                            label={t("richTextEditor.imageShadowColor")}
                            value={imageShadowColor}
                            onChange={(e) =>
                              setImageShadowColor(e.target.value)
                            }
                            fullWidth
                            placeholder="rgba(0, 0, 0, 0.3)"
                          />
                          <Box
                            component="input"
                            type="color"
                            value={
                              imageShadowColor.startsWith("rgba") ||
                              imageShadowColor.startsWith("rgb")
                                ? "#000000"
                                : imageShadowColor
                            }
                            onChange={(e) =>
                              setImageShadowColor(
                                (e.target as HTMLInputElement).value,
                              )
                            }
                            sx={{
                              width: 60,
                              height: 40,
                              border: "none",
                              borderRadius: 1,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Box>
            </Box>

            {/* Right Panel: Preview */}
            <Box
              sx={{
                width: "50%",
                height: "100%",
                overflow: "auto",
                p: 3,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(0, 0, 0, 0.2)"
                    : "rgba(0, 0, 0, 0.02)",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                  {t("richTextEditor.imagePreview")}
                </Typography>
                {imageUrl ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      display: "flex",
                      justifyContent:
                        imageAlign === "left"
                          ? "flex-start"
                          : imageAlign === "right"
                            ? "flex-end"
                            : "center",
                      minHeight: 300,
                      flex: 1,
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.01)",
                    }}
                  >
                    <Box
                      sx={{
                        display: "inline-block",
                        maxWidth: "100%",
                      }}
                    >
                      <Box
                        component="img"
                        key={imageUrl}
                        src={imageUrl}
                        alt={imageAltText || "Preview"}
                        sx={{
                          display: "block",
                          height: imageAspectRatio ? "auto" : undefined,
                          width:
                            imageWidth === "original"
                              ? "auto"
                              : imageWidth === "custom" && imageCustomWidth
                                ? `${imageCustomWidth}px`
                                : `${imageWidth}%`,
                          maxWidth: "100%",
                          maxHeight: 500,
                          objectFit: imageAspectRatio ? "contain" : "fill",
                          border:
                            imageBorder !== "none"
                              ? `${imageBorder === "thin" ? "1px" : imageBorder === "medium" ? "2px" : "3px"} solid ${imageBorderColor}`
                              : "none",
                          boxShadow:
                            imageShadow !== "none"
                              ? (() => {
                                  const blur =
                                    imageShadow === "small"
                                      ? "4px"
                                      : imageShadow === "medium"
                                        ? "8px"
                                        : "16px";
                                  const offset =
                                    imageShadow === "small"
                                      ? "2px"
                                      : imageShadow === "medium"
                                        ? "4px"
                                        : "8px";
                                  let shadowValue = "";
                                  if (imageShadowDirection === "all") {
                                    shadowValue = `0 0 ${blur}`;
                                  } else if (imageShadowDirection === "top") {
                                    shadowValue = `0 -${offset} ${blur}`;
                                  } else if (
                                    imageShadowDirection === "bottom"
                                  ) {
                                    shadowValue = `0 ${offset} ${blur}`;
                                  } else if (imageShadowDirection === "left") {
                                    shadowValue = `-${offset} 0 ${blur}`;
                                  } else if (imageShadowDirection === "right") {
                                    shadowValue = `${offset} 0 ${blur}`;
                                  }
                                  return `${shadowValue} ${imageShadowColor}`;
                                })()
                              : "none",
                          borderRadius:
                            imageBorderRadius !== "none"
                              ? imageBorderRadius === "small"
                                ? "4px"
                                : imageBorderRadius === "medium"
                                  ? "8px"
                                  : imageBorderRadius === "large"
                                    ? "16px"
                                    : imageBorderRadius === "custom" &&
                                        imageCustomBorderRadius
                                      ? `${imageCustomBorderRadius}px`
                                      : "0"
                              : "0",
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          // Show alt text when image fails to load
                          const parent = target.parentElement;
                          if (parent && imageAltText) {
                            const altTextElement =
                              document.createElement("div");
                            altTextElement.textContent = imageAltText;
                            altTextElement.style.padding = "20px";
                            altTextElement.style.color =
                              theme.palette.text.secondary;
                            altTextElement.style.textAlign = "center";
                            parent.appendChild(altTextElement);
                          }
                        }}
                      />
                    </Box>
                  </Paper>
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 300,
                      flex: 1,
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.01)",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t("richTextEditor.imageUrlHelp")}
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleImageDialogClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleImageInsert}
            variant="contained"
            disabled={
              !imageUrl ||
              imageUrlValid !== true ||
              imageUrlValidating ||
              (imageWidth === "custom" && !imageCustomWidth)
            }
          >
            {t("common.insert")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Video Insert Dialog */}
      <Dialog
        open={videoDialogOpen}
        onClose={handleVideoDialogClose}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{t("richTextEditor.insertVideo")}</DialogTitle>
        <DialogContent sx={{ height: "60vh", p: 0, overflow: "hidden" }}>
          <Box sx={{ display: "flex", height: "100%" }}>
            {/* Left Panel: Settings */}
            <Box
              sx={{
                width: "50%",
                height: "100%",
                overflow: "auto",
                p: 3,
                borderRight: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Video URL */}
                <TextField
                  autoFocus
                  label={t("richTextEditor.videoUrl")}
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  fullWidth
                  placeholder="https://www.youtube.com/watch?v=... / https://www.bilibili.com/video/BV... / https://www.tiktok.com/@user/video/..."
                  helperText={t("richTextEditor.videoUrlHelp")}
                />

                {/* Width */}
                <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>{t("richTextEditor.videoWidth")}</InputLabel>
                    <Select
                      value={videoWidth}
                      label={t("richTextEditor.videoWidth")}
                      onChange={(e) => setVideoWidth(e.target.value as any)}
                    >
                      <MenuItem value="25">25%</MenuItem>
                      <MenuItem value="50">50%</MenuItem>
                      <MenuItem value="75">75%</MenuItem>
                      <MenuItem value="100">100%</MenuItem>
                      <MenuItem value="custom">
                        {t("richTextEditor.videoWidthCustom")}
                      </MenuItem>
                    </Select>
                  </FormControl>

                  {/* Custom Width (conditional) */}
                  {videoWidth === "custom" && (
                    <TextField
                      label={t("richTextEditor.videoWidthPixels")}
                      value={videoCustomWidth}
                      onChange={(e) =>
                        setVideoCustomWidth(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="640"
                      sx={{ flex: 1 }}
                      type="number"
                    />
                  )}
                </Box>

                {/* Alignment */}
                <FormControl>
                  <FormLabel>{t("richTextEditor.videoAlign")}</FormLabel>
                  <RadioGroup
                    row
                    value={videoAlign}
                    onChange={(e) => setVideoAlign(e.target.value as any)}
                  >
                    <FormControlLabel
                      value="left"
                      control={<Radio />}
                      label={t("richTextEditor.videoAlignLeft")}
                    />
                    <FormControlLabel
                      value="center"
                      control={<Radio />}
                      label={t("richTextEditor.videoAlignCenter")}
                    />
                    <FormControlLabel
                      value="right"
                      control={<Radio />}
                      label={t("richTextEditor.videoAlignRight")}
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
                    label={t("richTextEditor.videoAutoplay")}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 4 }}
                  >
                    {t("richTextEditor.videoAutoplayHelp")}
                  </Typography>
                </FormControl>

                {/* Muted */}
                <FormControl>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={videoMuted}
                        onChange={(e) => setVideoMuted(e.target.checked)}
                      />
                    }
                    label={t("richTextEditor.videoMuted")}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 4 }}
                  >
                    {t("richTextEditor.videoMutedHelp")}
                  </Typography>
                </FormControl>

                {/* Loop */}
                <FormControl>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={videoLoop}
                        onChange={(e) => setVideoLoop(e.target.checked)}
                      />
                    }
                    label={t("richTextEditor.videoLoop")}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ ml: 4 }}
                  >
                    {t("richTextEditor.videoLoopHelp")}
                  </Typography>
                </FormControl>
              </Box>
            </Box>

            {/* Right Panel: Preview */}
            <Box
              sx={{
                width: "50%",
                height: "100%",
                overflow: "auto",
                p: 3,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(0, 0, 0, 0.2)"
                    : "rgba(0, 0, 0, 0.02)",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                  {t("richTextEditor.videoPreview")}
                </Typography>
                {videoPreviewUrl ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      flex: 1,
                      backgroundColor:
                        theme.palette.mode === "dark" ? "grey.900" : "grey.50",
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        paddingBottom: "56.25%", // 16:9 aspect ratio
                        height: 0,
                        overflow: "hidden",
                      }}
                    >
                      <iframe
                        src={videoPreviewUrl}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          border: "none",
                        }}
                        allowFullScreen
                      />
                    </Box>
                  </Paper>
                ) : videoUrlValidating ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 300,
                      flex: 1,
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.01)",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t("richTextEditor.validatingVideoUrl", "URL 검증 중...")}
                    </Typography>
                  </Paper>
                ) : videoUrl ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 300,
                      flex: 1,
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.01)",
                    }}
                  >
                    <Typography variant="body2" color="error">
                      {t("richTextEditor.invalidVideoUrl")}
                    </Typography>
                  </Paper>
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 300,
                      flex: 1,
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.02)"
                          : "rgba(0, 0, 0, 0.01)",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t("richTextEditor.videoUrlHelp")}
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleVideoDialogClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleVideoInsert}
            variant="contained"
            disabled={
              !videoUrl ||
              !videoPreviewUrl ||
              (videoWidth === "custom" && !videoCustomWidth)
            }
          >
            {t("common.insert")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RichTextEditor;
