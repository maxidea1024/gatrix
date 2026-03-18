import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  TableChart as TableChartIcon,
  Code as JsonIcon,
  Description as ExcelIcon,
} from '@mui/icons-material';

interface ExportImportMenuItemsProps {
  onExport: (format: 'csv' | 'json' | 'xlsx') => void;
  onImportClick?: () => void;
  exportOnly?: boolean;
  jsonOnly?: boolean;
}

const ExportImportMenuItems: React.FC<ExportImportMenuItemsProps> = ({
  onExport,
  onImportClick,
  exportOnly = false,
  jsonOnly = false,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {jsonOnly ? (
        <>
          <MenuItem onClick={() => onExport('json')}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('common.export')}</ListItemText>
          </MenuItem>
          {!exportOnly && onImportClick && (
            <MenuItem onClick={onImportClick}>
              <ListItemIcon>
                <UploadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('common.import')}</ListItemText>
            </MenuItem>
          )}
        </>
      ) : (
        <>
          {/* Export section header */}
          <MenuItem disabled sx={{ opacity: 1, pointerEvents: 'none' }}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Typography variant="subtitle2" color="text.secondary">
                {t('common.export')}
              </Typography>
            </ListItemText>
          </MenuItem>
          <MenuItem onClick={() => onExport('csv')} sx={{ pl: 4 }}>
            <ListItemIcon>
              <TableChartIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>CSV</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => onExport('json')} sx={{ pl: 4 }}>
            <ListItemIcon>
              <JsonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>JSON</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => onExport('xlsx')} sx={{ pl: 4 }}>
            <ListItemIcon>
              <ExcelIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Excel (XLSX)</ListItemText>
          </MenuItem>

          {/* Import section */}
          {!exportOnly && onImportClick && (
            <>
              <Divider />
              <MenuItem disabled sx={{ opacity: 1, pointerEvents: 'none' }}>
                <ListItemIcon>
                  <UploadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('common.import')}
                  </Typography>
                </ListItemText>
              </MenuItem>
              <MenuItem onClick={onImportClick} sx={{ pl: 4 }}>
                <ListItemIcon>
                  <UploadIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('common.importFromFile')}</ListItemText>
              </MenuItem>
            </>
          )}
        </>
      )}
    </>
  );
};

export default ExportImportMenuItems;
