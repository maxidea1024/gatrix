import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Box, Paper, IconButton, Popover } from '@mui/material';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import EmojiPicker, { EmojiClickData, Theme as EmojiTheme, Categories } from 'emoji-picker-react';
import { EmojiEmotions as EmojiIcon } from '@mui/icons-material';

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

  // Handle emoji picker
  const handleEmojiClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setEmojiAnchorEl(event.currentTarget);
  };

  const handleEmojiClose = () => {
    setEmojiAnchorEl(null);
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const range = editor.getSelection();
      const position = range ? range.index : editor.getLength();
      editor.insertText(position, emojiData.emoji);
      editor.setSelection(position + emojiData.emoji.length, 0);
    }
    handleEmojiClose();
  };

  const emojiOpen = Boolean(emojiAnchorEl);

  // Quill modules configuration
  const modules = useMemo(
    () => ({
      toolbar: readOnly
        ? false
        : [
            [{ header: [1, 2, 3, false] }],
            [{ size: ['small', false, 'large', 'huge'] }], // Font size selector
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ align: [] }], // Text alignment
            ['link'],
            ['clean'],
          ],
      clipboard: {
        matchVisual: false,
      },
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
      </Paper>

      {/* Emoji Button - Positioned at the end of toolbar */}
      {!readOnly && (
        <IconButton
          onClick={handleEmojiClick}
          size="small"
          sx={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 1,
            color: theme.palette.text.primary,
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
    </Box>
  );
};

export default RichTextEditor;

