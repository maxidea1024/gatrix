import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import {
  WavingHand,
  RadioButtonChecked,
  CheckBox,
  ShortText,
  Notes,
  Star,
  LinearScale,
  ArrowDropDownCircle,
  Celebration,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { QuestionType } from '@/services/surveyTemplateService';

const ICON_MAP: Record<QuestionType, React.ReactElement> = {
  welcome: <WavingHand fontSize="small" />,
  single_choice: <RadioButtonChecked fontSize="small" />,
  multiple_choice: <CheckBox fontSize="small" />,
  short_text: <ShortText fontSize="small" />,
  long_text: <Notes fontSize="small" />,
  rating: <Star fontSize="small" />,
  linear_scale: <LinearScale fontSize="small" />,
  dropdown: <ArrowDropDownCircle fontSize="small" />,
  ending: <Celebration fontSize="small" />,
};

export function getQuestionIcon(type: QuestionType): React.ReactElement {
  return ICON_MAP[type] || <ShortText fontSize="small" />;
}

interface Props {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onSelect: (type: QuestionType) => void;
}

const CATEGORIES = [
  {
    labelKey: 'choice',
    types: ['single_choice', 'multiple_choice', 'dropdown'] as QuestionType[],
  },
  {
    labelKey: 'input',
    types: ['short_text', 'long_text'] as QuestionType[],
  },
  {
    labelKey: 'scale',
    types: ['rating', 'linear_scale'] as QuestionType[],
  },
];

const TYPE_LABEL_KEYS: Record<QuestionType, string> = {
  welcome: 'surveyTemplate.questionTypes.welcome',
  single_choice: 'surveyTemplate.questionTypes.singleChoice',
  multiple_choice: 'surveyTemplate.questionTypes.multipleChoice',
  short_text: 'surveyTemplate.questionTypes.shortText',
  long_text: 'surveyTemplate.questionTypes.longText',
  rating: 'surveyTemplate.questionTypes.rating',
  linear_scale: 'surveyTemplate.questionTypes.linearScale',
  dropdown: 'surveyTemplate.questionTypes.dropdown',
  ending: 'surveyTemplate.questionTypes.ending',
};

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content',
  choice: 'Choice',
  input: 'Input',
  scale: 'Scale',
};

const QuestionTypeMenu: React.FC<Props> = ({
  anchorEl,
  open,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { minWidth: 220, maxHeight: 400 },
      }}
    >
      {CATEGORIES.map((cat, catIdx) => (
        <React.Fragment key={cat.labelKey}>
          {catIdx > 0 && <Divider />}
          <Typography
            variant="overline"
            sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}
          >
            {CATEGORY_LABELS[cat.labelKey]}
          </Typography>
          {cat.types.map((type) => (
            <MenuItem
              key={type}
              onClick={() => {
                onSelect(type);
                onClose();
              }}
            >
              <ListItemIcon>{ICON_MAP[type]}</ListItemIcon>
              <ListItemText>{t(TYPE_LABEL_KEYS[type])}</ListItemText>
            </MenuItem>
          ))}
        </React.Fragment>
      ))}
    </Menu>
  );
};

export default QuestionTypeMenu;
