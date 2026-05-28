import React from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  TextField,
  Divider,
  Checkbox,
  FormControlLabel,
  IconButton,
  Autocomplete,
  Slider,
} from '@mui/material';
import {
  RestorePage as ResetIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { HotTimeBuffOverride } from '@/services/operationEventService';
import { GameWorld } from '@/types/gameWorld';
import { RowData, DAY_BITS } from './types';
import { formatDayOfWeek, formatDateShort } from './utils';
import FeatureSwitch from '@/components/common/FeatureSwitch';

export interface HotTimeBuffDrawerProps {
  drawerRow: RowData | null;
  drawerDraft: HotTimeBuffOverride | null;
  drawerExtraBuffIds?: number[];
  drawerIsDirty: boolean;
  canManage: boolean;
  gameWorlds: GameWorld[];
  allWorldBuffs: Map<number, { name: string; desc: string }>;
  updateDraft: (field: string, value: any) => void;
  setDrawerDraft: React.Dispatch<
    React.SetStateAction<HotTimeBuffOverride | null>
  >;
  setDrawerExtraBuffIds?: React.Dispatch<React.SetStateAction<number[]>>;
  toggleDraftDayBit: (bit: number) => void;
  toggleDraftWorldBuff: (id: number) => void;
  selectAllWorldBuffs: () => void;
  deselectAllWorldBuffs: () => void;
  resetDrawerDraft?: () => void;
  commitDrawerDraft: () => void;
  closeDrawer: () => void;
  formatWorldBuffLabel: (
    id: number,
    info?: { name: string; desc: string } | null
  ) => string;
}

const HotTimeBuffDrawer: React.FC<HotTimeBuffDrawerProps> = ({
  drawerRow,
  drawerDraft,
  drawerExtraBuffIds = [],
  drawerIsDirty,
  canManage,
  gameWorlds,
  allWorldBuffs,
  updateDraft,
  setDrawerDraft,
  setDrawerExtraBuffIds,
  toggleDraftDayBit,
  toggleDraftWorldBuff,
  selectAllWorldBuffs,
  deselectAllWorldBuffs,
  resetDrawerDraft,
  commitDrawerDraft,
  closeDrawer,
  formatWorldBuffLabel,
}) => {
  const { t } = useTranslation();

  if (!drawerRow || !drawerDraft) return null;

  const cms = drawerRow.cmsItem;
  const draft = drawerDraft;
  const dayBits = draft.bitFlagDayOfWeekOverride ?? cms.bitFlagDayOfWeek;
  const activeWorldBuffIds = draft.worldBuffIdOverride || cms.worldBuffId || [];
  const cmsBuffIds = cms.worldBuffId || [];
  const savedExtraIds = (
    drawerRow.savedOverride?.worldBuffIdOverride || []
  ).filter((id) => !cmsBuffIds.includes(id));
  const localExtraIds = (draft.worldBuffIdOverride || []).filter(
    (id) => !cmsBuffIds.includes(id)
  );
  const extraBuffIds = [
    ...new Set([
      ...savedExtraIds,
      ...localExtraIds,
      ...(drawerExtraBuffIds || []),
    ]),
  ];

  const hasOverrideValues =
    draft.enabled === false ||
    draft.startDateOverride != null ||
    draft.endDateOverride != null ||
    draft.startHourOverride != null ||
    draft.endHourOverride != null ||
    draft.minLvOverride != null ||
    draft.maxLvOverride != null ||
    draft.bitFlagDayOfWeekOverride != null ||
    draft.worldBuffIdOverride != null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Scrollable content area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* CMS Info */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          CMS
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1,
            mb: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'action.hover',
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('hotTimeBuffEvent.startDate')}
            </Typography>
            <Typography variant="body2">
              {formatDateShort(cms.startDate)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('hotTimeBuffEvent.endDate')}
            </Typography>
            <Typography variant="body2">
              {formatDateShort(cms.endDate)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('hotTimeBuffEvent.startHour')} ~{' '}
              {t('hotTimeBuffEvent.endHour')}
            </Typography>
            <Typography variant="body2">
              {cms.startHour} ~ {cms.endHour}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Lv
            </Typography>
            <Typography variant="body2">
              {cms.minLv} ~ {cms.maxLv}
            </Typography>
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="caption" color="text.secondary">
              {t('hotTimeBuffEvent.dayOfWeek')}
            </Typography>
            <Typography variant="body2">
              {formatDayOfWeek(cms.bitFlagDayOfWeek, t)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* World selector */}
        {gameWorlds.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 0.5 }}
            >
              {t('hotTimeBuffEvent.colWorld')}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!draft.worldIds || draft.worldIds.length === 0}
                  onChange={(_, checked) => {
                    if (checked) {
                      updateDraft('worldIds', null);
                    } else {
                      updateDraft(
                        'worldIds',
                        draft.worldIds?.length ? [...draft.worldIds] : []
                      );
                    }
                  }}
                  disabled={!canManage}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" fontWeight={600}>
                  {t('hotTimeBuffEvent.globalAllWorlds')}
                </Typography>
              }
              sx={{ mb: 0.5 }}
            />
            {Array.isArray(draft.worldIds) && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0,
                  pl: 1,
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1,
                }}
              >
                {gameWorlds.map((w) => (
                  <FormControlLabel
                    key={w.worldId}
                    control={
                      <Checkbox
                        size="small"
                        checked={(draft.worldIds || []).includes(w.worldId)}
                        onChange={(_, checked) => {
                          const current = draft.worldIds || [];
                          const updated = checked
                            ? [...current, w.worldId]
                            : current.filter((id: string) => id !== w.worldId);
                          updateDraft('worldIds', updated);
                        }}
                        disabled={!canManage}
                      />
                    }
                    label={
                      <Typography variant="body2" fontSize="0.8rem">
                        {w.worldId}
                        {w.name ? ` (${w.name})` : ''}
                      </Typography>
                    }
                    sx={{ minWidth: '45%', mr: 0 }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Enabled toggle */}
        <Box sx={{ mb: 2 }}>
          <FeatureSwitch
            checked={draft.enabled}
            onChange={() => updateDraft('enabled', !draft.enabled)}
            disabled={!canManage}
            size="medium"
            label={t('hotTimeBuffEvent.enabled')}
          />
        </Box>

        {/* Date overrides */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {t('hotTimeBuffEvent.override')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label={t('hotTimeBuffEvent.startDate')}
            type="date"
            value={draft.startDateOverride?.substring(0, 10) || ''}
            onChange={(e) =>
              updateDraft('startDateOverride', e.target.value || null)
            }
            size="small"
            fullWidth
            disabled={!canManage}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t('hotTimeBuffEvent.endDate')}
            type="date"
            value={draft.endDateOverride?.substring(0, 10) || ''}
            onChange={(e) =>
              updateDraft('endDateOverride', e.target.value || null)
            }
            size="small"
            fullWidth
            disabled={!canManage}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
        <Box sx={{ mb: 2, px: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('hotTimeBuffEvent.startHour')} ~ {t('hotTimeBuffEvent.endHour')}:{' '}
            {draft.startHourOverride ?? cms.startHour} ~{' '}
            {draft.endHourOverride ?? cms.endHour}
            {t('hotTimeBuffEvent.hourUnit')}
          </Typography>
          <Slider
            value={[
              draft.startHourOverride ?? cms.startHour,
              draft.endHourOverride ?? cms.endHour,
            ]}
            onChange={(_, val) => {
              const [s, e] = val as number[];
              updateDraft('startHourOverride', s);
              updateDraft('endHourOverride', e);
            }}
            min={0}
            max={24}
            step={1}
            marks={[
              { value: 0, label: '0' },
              { value: 6, label: '6' },
              { value: 12, label: '12' },
              { value: 18, label: '18' },
              { value: 24, label: '24' },
            ]}
            valueLabelDisplay="auto"
            disabled={!canManage}
            size="small"
          />
        </Box>
        <Box sx={{ mb: 2, px: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('hotTimeBuffEvent.minLv')} ~ {t('hotTimeBuffEvent.maxLv')}:{' '}
            {draft.minLvOverride ?? cms.minLv} ~{' '}
            {draft.maxLvOverride ?? cms.maxLv}
          </Typography>
          <Slider
            value={[
              draft.minLvOverride ?? cms.minLv ?? 1,
              draft.maxLvOverride ?? cms.maxLv ?? 200,
            ]}
            onChange={(_, val) => {
              const [min, max] = val as number[];
              updateDraft('minLvOverride', min);
              updateDraft('maxLvOverride', max);
            }}
            min={1}
            max={200}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 50, label: '50' },
              { value: 100, label: '100' },
              { value: 150, label: '150' },
              { value: 200, label: '200' },
            ]}
            valueLabelDisplay="auto"
            disabled={!canManage}
            size="small"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Day-of-week toggle */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {t('hotTimeBuffEvent.dayOfWeek')}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {DAY_BITS.map((d) => {
            const isOn = !!(dayBits & (1 << d.bit));
            return (
              <Chip
                key={d.bit}
                label={t(`hotTimeBuffEvent.${d.key}`)}
                onClick={canManage ? () => toggleDraftDayBit(d.bit) : undefined}
                color={isOn ? 'primary' : 'default'}
                variant={isOn ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: isOn ? 600 : 400 }}
              />
            );
          })}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* World buff checkboxes */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {t('hotTimeBuffEvent.worldBuffList')} (CMS:{' '}
            {cms.worldBuffId?.length || 0}
            {extraBuffIds.length > 0
              ? ` + ${t('hotTimeBuffEvent.buffAdded')}: ${extraBuffIds.length}`
              : ''}
            )
          </Typography>
          {canManage && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button size="small" variant="text" onClick={selectAllWorldBuffs}>
                {t('hotTimeBuffEvent.selectAll')}
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={deselectAllWorldBuffs}
              >
                {t('hotTimeBuffEvent.deselectAll')}
              </Button>
            </Box>
          )}
        </Box>
        <TableContainer
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 42 }} />
                <TableCell
                  sx={{ width: 56, fontWeight: 600, fontSize: '0.75rem' }}
                >
                  {t('hotTimeBuffEvent.buffSource')}
                </TableCell>
                <TableCell
                  sx={{ width: 90, fontWeight: 600, fontSize: '0.75rem' }}
                >
                  ID
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {t('hotTimeBuffEvent.buffName')}
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {t('hotTimeBuffEvent.buffDesc')}
                </TableCell>
                {canManage && extraBuffIds.length > 0 && (
                  <TableCell sx={{ width: 40 }} />
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {(cms.worldBuffId || []).map((wbId, i) => {
                const checked = activeWorldBuffIds.includes(wbId);
                const buffInfo = allWorldBuffs.get(wbId);
                const name =
                  buffInfo?.name ||
                  cms.worldBuffNames?.[i] ||
                  `WorldBuff #${wbId}`;
                const desc = buffInfo?.desc || '';
                return (
                  <TableRow key={wbId} sx={{ opacity: checked ? 1 : 0.5 }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={() => toggleDraftWorldBuff(wbId)}
                        disabled={!canManage}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label="CMS"
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {wbId}
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tooltip title={name} placement="top">
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontSize: '0.8rem' }}
                        >
                          {name}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'text.secondary',
                      }}
                    >
                      <Tooltip title={desc || '—'} placement="top">
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {desc || '—'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    {canManage && extraBuffIds.length > 0 && <TableCell />}
                  </TableRow>
                );
              })}
              {extraBuffIds.map((wbId) => {
                const buffInfo = allWorldBuffs.get(wbId);
                const name = buffInfo?.name || `WorldBuff #${wbId}`;
                const desc = buffInfo?.desc || '';
                const checked = activeWorldBuffIds.includes(wbId);
                return (
                  <TableRow
                    key={wbId}
                    sx={{ bgcolor: 'action.hover', opacity: checked ? 1 : 0.5 }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={checked}
                        disabled={!canManage}
                        onChange={() => toggleDraftWorldBuff(wbId)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t('hotTimeBuffEvent.buffAdded')}
                        size="small"
                        color="info"
                        variant="filled"
                        sx={{ height: 20, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {wbId}
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 160,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tooltip title={name} placement="top">
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontSize: '0.8rem' }}
                        >
                          {name}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 240,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'text.secondary',
                      }}
                    >
                      <Tooltip title={desc || '—'} placement="top">
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {desc || '—'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    {canManage && (
                      <TableCell sx={{ px: 0.5 }}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => toggleDraftWorldBuff(wbId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add new world buff via selector */}
        {canManage &&
          (() => {
            const availableOptions = Array.from(allWorldBuffs.entries())
              .filter(([id]) => !activeWorldBuffIds.includes(id))
              .map(([id, info]) => ({
                id,
                label: formatWorldBuffLabel(id, info),
              }));
            if (availableOptions.length === 0) return null;
            return (
              <Autocomplete
                options={availableOptions}
                getOptionLabel={(opt) => opt.label}
                size="small"
                sx={{ mt: 1 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t('hotTimeBuffEvent.addWorldBuff')}
                    size="small"
                  />
                )}
                onChange={(_, val) => {
                  if (val) {
                    setDrawerDraft((prev) => {
                      if (!prev) return prev;
                      const current = prev.worldBuffIdOverride || [
                        ...(cms.worldBuffId || []),
                      ];
                      return {
                        ...prev,
                        worldBuffIdOverride: [...current, val.id],
                      };
                    });
                    if (
                      !(cms.worldBuffId || []).includes(val.id) &&
                      setDrawerExtraBuffIds
                    ) {
                      setDrawerExtraBuffIds((prev) =>
                        prev.includes(val.id) ? prev : [...prev, val.id]
                      );
                    }
                  }
                }}
                value={null}
                blurOnSelect
              />
            );
          })()}

        {/* Reset override */}
        {canManage && hasOverrideValues && resetDrawerDraft && (
          <Box sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<ResetIcon />}
              onClick={resetDrawerDraft}
              fullWidth
            >
              {t('hotTimeBuffEvent.resetOverride')}
            </Button>
          </Box>
        )}
      </Box>

      {/* Footer — Cancel / Update */}
      {canManage && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Button variant="contained" size="small" onClick={closeDrawer}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={commitDrawerDraft}
            disabled={!drawerIsDirty}
          >
            {t('hotTimeBuffEvent.update')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default HotTimeBuffDrawer;
