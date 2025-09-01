import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  BulkCreateFormData,
  PlatformSpecificSettings,
  ClientStatus,
  CLIENT_VERSION_VALIDATION,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import { tagService } from '../../services/tagService';

// 클라이언트 상태 라벨 매핑
const ClientStatusLabels = {
  [ClientStatus.ONLINE]: 'clientVersions.status.online',
  [ClientStatus.OFFLINE]: 'clientVersions.status.offline',
  [ClientStatus.RECOMMENDED_UPDATE]: 'clientVersions.status.recommendedUpdate',
  [ClientStatus.FORCED_UPDATE]: 'clientVersions.status.forcedUpdate',
  [ClientStatus.UNDER_REVIEW]: 'clientVersions.status.underReview',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]: 'clientVersions.status.blockedPatchAllowed',
};

interface BulkClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 사용 가능한 플랫폼 목록 (기존 개별 추가 폼과 동일)
const AVAILABLE_PLATFORMS = [
  'pc',
  'pc-wegame',
  'ios',
  'android',
  'harmonyos',
];

// 폼 유효성 검사 스키마
const createValidationSchema = (t: any) => yup.object({
  clientVersion: yup
    .string()
    .required(t('clientVersions.form.versionRequired'))
    .matches(
      CLIENT_VERSION_VALIDATION.CLIENT_VERSION.PATTERN,
      t('clientVersions.form.versionInvalid')
    ),
  clientStatus: yup
    .string()
    .required(t('clientVersions.form.statusRequired'))
    .oneOf(Object.values(ClientStatus)),
  guestModeAllowed: yup.boolean().required(),
  externalClickLink: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.EXTERNAL_LINK.MAX_LENGTH)
    .optional(),
  memo: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.MEMO.MAX_LENGTH)
    .optional(),
  customPayload: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.CUSTOM_PAYLOAD.MAX_LENGTH)
    .optional(),
  platforms: yup
    .array()
    .of(
      yup.object({
        platform: yup.string().required(),
        gameServerAddress: yup
          .string()
          .required(t('clientVersions.form.gameServerRequired'))
          .min(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MIN_LENGTH)
          .max(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MAX_LENGTH),
        gameServerAddressForWhiteList: yup
          .string()
          .max(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MAX_LENGTH)
          .optional(),
        patchAddress: yup
          .string()
          .required(t('clientVersions.form.patchAddressRequired'))
          .min(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MIN_LENGTH)
          .max(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MAX_LENGTH),
        patchAddressForWhiteList: yup
          .string()
          .max(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MAX_LENGTH)
          .optional(),
      })
    )
    .min(1, t('clientVersions.form.selectAtLeastOnePlatform'))
    .required(),
});

const BulkClientVersionForm: React.FC<BulkClientVersionFormProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string; color: string }[]>([]);

  // 기본값 설정
  const defaultValues: BulkCreateFormData = {
    clientVersion: '',
    clientStatus: ClientStatus.OFFLINE,
    guestModeAllowed: false,
    externalClickLink: '',
    memo: '',
    customPayload: '',
    platforms: [],
    tags: [],
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
    setError,
  } = useForm<BulkCreateFormData>({
    resolver: yupResolver(createValidationSchema(t)),
    defaultValues,
  });

  // 폼 초기화
  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setSelectedPlatforms([]);
      setSelectedTags([]);
    }
  }, [open, reset]);

  // 태그 목록 로드
  useEffect(() => {
    if (open) {
      const loadTags = async () => {
        try {
          const tags = await tagService.list();
          setAllTags(tags);
        } catch (error) {
          console.error('Failed to load tags:', error);
        }
      };
      loadTags();
    }
  }, [open]);

  // 선택된 플랫폼이 변경될 때 platforms 배열 업데이트
  useEffect(() => {
    const newPlatforms: PlatformSpecificSettings[] = selectedPlatforms.map(platform => ({
      platform,
      gameServerAddress: '',
      gameServerAddressForWhiteList: '',
      patchAddress: '',
      patchAddressForWhiteList: '',
    }));
    setValue('platforms', newPlatforms);
  }, [selectedPlatforms, setValue]);

  // 플랫폼 선택 핸들러
  const handlePlatformChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedPlatforms(typeof value === 'string' ? value.split(',') : value);
  };

  // 폼 제출 핸들러
  const onSubmit = async (data: BulkCreateFormData) => {
    // 플랫폼 선택 검증
    if (selectedPlatforms.length === 0) {
      setError('platforms', {
        type: 'manual',
        message: t('clientVersions.form.selectAtLeastOnePlatform')
      });
      return;
    }

    try {
      setLoading(true);

      // 빈 문자열을 undefined로 변환하고 tags 필드 제거 (별도 처리)
      const { tags, ...dataWithoutTags } = data;
      const cleanedData = {
        ...dataWithoutTags,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
        platforms: data.platforms.map(platform => ({
          ...platform,
          gameServerAddressForWhiteList: platform.gameServerAddressForWhiteList || undefined,
          patchAddressForWhiteList: platform.patchAddressForWhiteList || undefined,
        }))
      };

      const result = await ClientVersionService.bulkCreateClientVersions(cleanedData);

      // 생성된 각 클라이언트 버전에 태그 설정
      if (selectedTags && selectedTags.length > 0) {
        const tagIds = selectedTags.map(tag => tag.id);
        await Promise.all(
          result.map((clientVersion: any) =>
            ClientVersionService.setTags(clientVersion.id, tagIds)
          )
        );
      }

      enqueueSnackbar(
        t('clientVersions.bulkCreateSuccess', { count: result.length }),
        { variant: 'success' }
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating client versions:', error);
      enqueueSnackbar(
        error.message || t('clientVersions.bulkCreateFailed'),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        {t('clientVersions.bulkAdd')}
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            {/* 기본 정보 */}
            <Typography variant="h6" gutterBottom>
              {t('clientVersions.form.basicInfo')}
            </Typography>

            {/* 버전 필드 */}
            <Controller
              name="clientVersion"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.version')}
                    placeholder={CLIENT_VERSION_VALIDATION.CLIENT_VERSION.EXAMPLE}
                    error={!!errors.clientVersion}
                    helperText={errors.clientVersion?.message}
                    inputProps={{
                      autoComplete: 'off',
                      autoCorrect: 'off',
                      autoCapitalize: 'off',
                      spellCheck: false
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.versionHelp')}
                  </Typography>
                </Box>
              )}
            />

            {/* 플랫폼 선택 (멀티셀렉트) */}
            <Box>
              <FormControl fullWidth error={!!errors.platforms}>
                <InputLabel id="bulk-platform-label">{t('clientVersions.selectPlatforms')}</InputLabel>
                <Select
                  labelId="bulk-platform-label"
                  multiple
                  value={selectedPlatforms}
                  onChange={handlePlatformChange}
                  input={<OutlinedInput label={t('clientVersions.selectPlatforms')} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value.toUpperCase()} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {AVAILABLE_PLATFORMS.map((platform) => (
                    <MenuItem key={platform} value={platform}>
                      {platform.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
                {errors.platforms && (
                  <Typography variant="caption" color="error">
                    {errors.platforms.message}
                  </Typography>
                )}
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('clientVersions.form.platformHelp')}
              </Typography>
            </Box>

            {/* 상태 */}
            <Controller
              name="clientStatus"
              control={control}
              render={({ field }) => (
                <Box>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="bulk-status-label" shrink={true}>{t('clientVersions.statusLabel')}</InputLabel>
                    <Select
                      labelId="bulk-status-label"
                      {...field}
                      label={t('clientVersions.statusLabel')}
                    >
                      {Object.values(ClientStatus).map((status) => (
                        <MenuItem key={status} value={status}>
                          {t(ClientStatusLabels[status])}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.statusHelp')}
                  </Typography>
                </Box>
              )}
            />

            {/* 추가 설정 */}
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              {t('clientVersions.form.additionalSettings')}
            </Typography>

            <Controller
              name="guestModeAllowed"
              control={control}
              render={({ field }) => (
                <Box>
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label={t('clientVersions.guestModeAllowed')}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.guestModeAllowedHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="externalClickLink"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.externalClickLink')}
                    error={!!errors.externalClickLink}
                    helperText={errors.externalClickLink?.message}
                    inputProps={{
                      autoComplete: 'off',
                      autoCorrect: 'off',
                      autoCapitalize: 'off',
                      spellCheck: false
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.externalClickLinkHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="memo"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.memo')}
                    multiline
                    rows={3}
                    error={!!errors.memo}
                    helperText={errors.memo?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.memoHelp')}
                  </Typography>
                </Box>
              )}
            />

            {/* 플랫폼별 서버 주소 설정 */}
            {selectedPlatforms.length > 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  {t('clientVersions.form.serverAddresses')}
                </Typography>

                {selectedPlatforms.map((platform, index) => (
                  <Box key={platform} sx={{ mb: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {platform.toUpperCase()}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Controller
                        name={`platforms.${index}.gameServerAddress`}
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              fullWidth
                              label={t('clientVersions.gameServerAddress')}
                              error={!!errors.platforms?.[index]?.gameServerAddress}
                              helperText={errors.platforms?.[index]?.gameServerAddress?.message}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {t('clientVersions.form.gameServerAddressHelp')}
                            </Typography>
                          </Box>
                        )}
                      />

                      <Controller
                        name={`platforms.${index}.gameServerAddressForWhiteList`}
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              fullWidth
                              label={t('clientVersions.gameServerAddressForWhiteList')}
                              error={!!errors.platforms?.[index]?.gameServerAddressForWhiteList}
                              helperText={errors.platforms?.[index]?.gameServerAddressForWhiteList?.message}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {t('clientVersions.form.gameServerAddressForWhiteListHelp')}
                            </Typography>
                          </Box>
                        )}
                      />

                      <Controller
                        name={`platforms.${index}.patchAddress`}
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              fullWidth
                              label={t('clientVersions.patchAddress')}
                              error={!!errors.platforms?.[index]?.patchAddress}
                              helperText={errors.platforms?.[index]?.patchAddress?.message}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {t('clientVersions.form.patchAddressHelp')}
                            </Typography>
                          </Box>
                        )}
                      />

                      <Controller
                        name={`platforms.${index}.patchAddressForWhiteList`}
                        control={control}
                        render={({ field }) => (
                          <Box>
                            <TextField
                              {...field}
                              fullWidth
                              label={t('clientVersions.patchAddressForWhiteList')}
                              error={!!errors.platforms?.[index]?.patchAddressForWhiteList}
                              helperText={errors.platforms?.[index]?.patchAddressForWhiteList?.message}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              {t('clientVersions.form.patchAddressForWhiteListHelp')}
                            </Typography>
                          </Box>
                        )}
                      />
                    </Box>
                  </Box>
                ))}
              </>
            )}

            {/* 태그 선택 */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t('common.tags')}
              </Typography>

              <TextField
                select
                multiple
                label={t('common.tags')}
                value={selectedTags.map(tag => tag.id)}
                onChange={(e) => {
                  const selectedIds = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                  const newSelectedTags = allTags.filter(tag => selectedIds.includes(tag.id));
                  setSelectedTags(newSelectedTags);
                  setValue('tags', newSelectedTags);
                }}
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as number[]).map((id) => {
                        const tag = allTags.find(t => t.id === id);
                        return tag ? (
                          <Tooltip key={id} title={tag.description || tag.name} arrow>
                            <Chip
                              label={tag.name}
                              size="small"
                              sx={{ bgcolor: tag.color, color: '#fff' }}
                            />
                          </Tooltip>
                        ) : null;
                      })}
                    </Box>
                  ),
                }}
                helperText="생성될 모든 클라이언트 버전에 적용할 태그를 선택하세요"
                fullWidth
              >
                {allTags.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    <Chip
                      label={tag.name}
                      size="small"
                      sx={{ bgcolor: tag.color, color: '#fff', mr: 1 }}
                    />
                    {tag.description || '설명 없음'}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || isSubmitting}
          >
            {loading ? t('common.creating') : t('clientVersions.bulkCreate')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default BulkClientVersionForm;
