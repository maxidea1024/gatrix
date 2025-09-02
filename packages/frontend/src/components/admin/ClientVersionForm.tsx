import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
  Paper,
  Stack,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Save as SaveIcon,
  Add as AddIcon,
  FileCopy as CopyIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import FormDialogHeader from '../common/FormDialogHeader';
import {
  ClientVersion,
  ClientVersionFormData,
  ClientStatus,
  ClientStatusLabels,
  CLIENT_VERSION_VALIDATION,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import { tagService } from '../../services/tagService';
import JsonEditor from '../common/JsonEditor';

interface ClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientVersion?: ClientVersion | null;
  isCopyMode?: boolean;

}

// 폼 유효성 검사 스키마
const createValidationSchema = (t: any) => yup.object({
  platform: yup
    .string()
    .required(t('clientVersions.form.platformRequired'))
    .min(CLIENT_VERSION_VALIDATION.PLATFORM.MIN_LENGTH)
    .max(CLIENT_VERSION_VALIDATION.PLATFORM.MAX_LENGTH),
  clientVersion: yup
    .string()
    .required(t('clientVersions.form.versionRequired'))
    .matches(
      CLIENT_VERSION_VALIDATION.CLIENT_VERSION.PATTERN,
      t('clientVersions.form.versionInvalid')
    ),
  clientStatus: yup
    .string()
    .oneOf(Object.values(ClientStatus))
    .required(t('clientVersions.form.statusRequired')),
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
});

const ClientVersionForm: React.FC<ClientVersionFormProps> = ({
  open,
  onClose,
  onSuccess,
  clientVersion,
  isCopyMode = false,
  channels,
  subChannels,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const versionFieldRef = useRef<HTMLInputElement>(null);

  const isEdit = !!clientVersion && !isCopyMode;
  const [displayIsEdit, setDisplayIsEdit] = useState<boolean>(isEdit);
  const [displayIsCopy, setDisplayIsCopy] = useState<boolean>(!!isCopyMode);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string; color: string }[]>([]);

  // 기본값 설정
  const defaultValues: ClientVersionFormData = {
    platform: 'pc', // 첫 번째 플랫폼을 기본값으로 설정
    clientVersion: '',
    clientStatus: ClientStatus.OFFLINE, // 첫 번째 상태를 기본값으로 설정
    gameServerAddress: '',
    gameServerAddressForWhiteList: '',
    patchAddress: '',
    patchAddressForWhiteList: '',
    guestModeAllowed: false,
    externalClickLink: '',
    memo: '',
    customPayload: '',
    tags: [],
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<ClientVersionFormData>({
    resolver: yupResolver(createValidationSchema(t)),
    defaultValues,
  });

  // 폼 초기화
  useEffect(() => {
    if (open) {
      // 렌더링 상태에서 표시용 모드는 오픈 시점 값으로 고정하여 버튼 라벨 깜빡임 방지
      setDisplayIsEdit(!!clientVersion && !isCopyMode);
      setDisplayIsCopy(!!isCopyMode);

      if (clientVersion) {
        // 편집 모드 또는 복사 모드일 때 기존 데이터로 초기화
        console.log('Initializing form with clientVersion data:', {
          isEdit,
          isCopyMode,
          clientVersion
        });

        reset({
          platform: clientVersion.platform,
          clientVersion: isCopyMode ? '' : clientVersion.clientVersion, // 복사 모드일 때만 버전 비움
          clientStatus: clientVersion.clientStatus,
          gameServerAddress: clientVersion.gameServerAddress,
          gameServerAddressForWhiteList: clientVersion.gameServerAddressForWhiteList || '',
          patchAddress: clientVersion.patchAddress,
          patchAddressForWhiteList: clientVersion.patchAddressForWhiteList || '',
          guestModeAllowed: clientVersion.guestModeAllowed,
          externalClickLink: clientVersion.externalClickLink || '',
          memo: clientVersion.memo || '',
          customPayload: clientVersion.customPayload || '',
          tags: clientVersion.tags || [],
        });
        setSelectedTags(clientVersion.tags || []);
      } else {
        // 새로 생성할 때 기본값으로 초기화
        console.log('Initializing form with default values');
        reset(defaultValues);
        setSelectedTags([]);
      }
      setDuplicateError(null);

      // 복사 모드이거나 새로 추가할 때 버전 필드에 포커스
      if (isCopyMode || !clientVersion) {
        setTimeout(() => {
          versionFieldRef.current?.focus();
        }, 100);
      }
    }
  }, [open, isEdit, isCopyMode, clientVersion, reset]);

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

  // 중복 검사
  const watchedValues = watch(['channel', 'subChannel', 'clientVersion']);
  useEffect(() => {
    const [channel, subChannel, version] = watchedValues;
    if (channel && subChannel && version) {
      const checkDuplicate = async () => {
        try {
          const isDuplicate = await ClientVersionService.checkDuplicate(
            channel,
            subChannel,
            version,
            isEdit ? clientVersion?.id : undefined
          );
          setDuplicateError(isDuplicate ? t('clientVersions.form.duplicateVersion') : null);
        } catch (error) {
          console.error('Error checking duplicate:', error);
        }
      };

      const timeoutId = setTimeout(checkDuplicate, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setDuplicateError(null);
    }
  }, [watchedValues, isEdit, clientVersion?.id, t]);

  // 폼 제출
  const onSubmit = async (data: ClientVersionFormData) => {
    console.log('=== FORM SUBMIT START ===');
    console.log('Form data:', data);
    console.log('isEdit:', isEdit);
    console.log('isCopyMode:', isCopyMode);
    console.log('clientVersion:', clientVersion);

    if (duplicateError) {
      console.log('Form submission blocked due to duplicate error:', duplicateError);
      return;
    }

    try {
      setLoading(true);
      console.log('Starting form submission...');

      // 빈 문자열을 undefined로 변환하고 tags 필드 제거 (별도 처리)
      const { tags, ...dataWithoutTags } = data;
      const cleanedData = {
        ...dataWithoutTags,
        gameServerAddressForWhiteList: data.gameServerAddressForWhiteList || undefined,
        patchAddressForWhiteList: data.patchAddressForWhiteList || undefined,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
      };

      console.log('Cleaned data to send:', cleanedData);

      let clientVersionId: number;

      if (isEdit && clientVersion) {
        console.log('Updating existing client version:', {
          id: clientVersion.id,
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion
        });

        if (!clientVersion.id) {
          throw new Error('Client version ID is missing');
        }

        console.log('About to call updateClientVersion API...');
        await ClientVersionService.updateClientVersion(clientVersion.id, cleanedData);
        console.log('updateClientVersion API call completed');
        clientVersionId = clientVersion.id;
        enqueueSnackbar(t('clientVersions.updateSuccess'), { variant: 'success' });
      } else {
        console.log('Creating new client version (copy mode or new):', {
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion
        });
        console.log('About to call createClientVersion API...');
        const created = await ClientVersionService.createClientVersion(cleanedData);
        console.log('createClientVersion API call completed');
        clientVersionId = created?.id || created?.data?.id;
        if (!clientVersionId) {
          throw new Error('생성된 클라이언트 버전 ID를 가져올 수 없습니다.');
        }
        enqueueSnackbar(t('clientVersions.createSuccess'), { variant: 'success' });
      }

      // 태그 설정
      if (selectedTags && selectedTags.length > 0) {
        await ClientVersionService.setTags(clientVersionId, selectedTags.map(tag => tag.id));
      } else {
        // 태그가 없으면 기존 태그 모두 제거
        await ClientVersionService.setTags(clientVersionId, []);
      }

      console.log('Form submission successful');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving client version:', error);
      enqueueSnackbar(error.message || t('clientVersions.saveError', 'Failed to save client version'), { variant: 'error' });
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
      <FormDialogHeader
        title={isCopyMode
          ? '클라이언트 버전 복사'
          : isEdit
            ? '클라이언트 버전 편집'
            : '클라이언트 버전 추가'
        }
        description={isCopyMode
          ? '기존 클라이언트 버전을 복사하여 새로운 버전을 생성할 수 있습니다.'
          : isEdit
            ? '기존 클라이언트 버전의 설정을 수정하고 업데이트할 수 있습니다.'
            : '새로운 클라이언트 버전을 생성하고 게임 서버 및 패치 설정을 구성할 수 있습니다.'
        }
      />

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.log('Form validation failed:', errors);
      })}>
        <DialogContent dividers>
          {duplicateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {duplicateError}
            </Alert>
          )}

          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 기본 정보 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                📋 {t('clientVersions.form.basicInfo')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.basicInfoDescription')}
              </Typography>

              <Stack spacing={2}>
                {/* 버전 필드 */}
                <Controller
                  name="clientVersion"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      inputRef={versionFieldRef}
                      fullWidth
                      label={
                        <Box component="span">
                          {t('clientVersions.version')} <Typography component="span" color="error">*</Typography>
                        </Box>
                      }
                      placeholder={CLIENT_VERSION_VALIDATION.CLIENT_VERSION.EXAMPLE}
                      error={!!errors.clientVersion}
                      helperText={errors.clientVersion?.message || t('clientVersions.form.versionHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 플랫폼 필드 */}
                <Controller
                  name="platform"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.platform}>
                      <InputLabel id="cvf-platform-label">
                        {t('clientVersions.platform')} <Typography component="span" color="error">*</Typography>
                      </InputLabel>
                      <Select
                        labelId="cvf-platform-label"
                        {...field}
                        label={`${t('clientVersions.platform')} *`}
                      >
                        {['pc','pc-wegame','ios','android','harmonyos'].map((p) => (
                          <MenuItem key={p} value={p}>
                            {p}
                          </MenuItem>
                        ))}
                      </Select>
                      {(errors.platform?.message || t('clientVersions.form.platformHelp')) && (
                        <Typography variant="caption" color={errors.platform ? "error" : "text.secondary"} sx={{ mt: 0.5, display: 'block' }}>
                          {errors.platform?.message || t('clientVersions.form.platformHelp')}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />

                {/* 상태 필드 */}
                <Controller
                  name="clientStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth variant="outlined">
                      <InputLabel id="cvf-status-label" shrink={true}>
                        {t('clientVersions.statusLabel')} <Typography component="span" color="error">*</Typography>
                      </InputLabel>
                      <Select
                        labelId="cvf-status-label"
                        {...field}
                        label={`${t('clientVersions.statusLabel')} *`}
                      >
                        {Object.values(ClientStatus).map((status) => (
                          <MenuItem key={status} value={status}>
                            {t(ClientStatusLabels[status])}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('clientVersions.form.statusHelp')}
                      </Typography>
                    </FormControl>
                  )}
                />
              </Stack>
            </Paper>

            {/* 서버 주소 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                🌐 {t('clientVersions.form.serverAddresses')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.serverAddressesDescription')}
              </Typography>

              <Stack spacing={2}>

                {/* 게임 서버 주소 */}
                <Controller
                  name="gameServerAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={
                        <Box component="span">
                          {t('clientVersions.gameServerAddress')} <Typography component="span" color="error">*</Typography>
                        </Box>
                      }
                      error={!!errors.gameServerAddress}
                      helperText={errors.gameServerAddress?.message || t('clientVersions.form.gameServerAddressHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 게임 서버 주소 (화이트리스트용) */}
                <Controller
                  name="gameServerAddressForWhiteList"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('clientVersions.gameServerAddressForWhiteList')}
                      error={!!errors.gameServerAddressForWhiteList}
                      helperText={errors.gameServerAddressForWhiteList?.message || t('clientVersions.form.gameServerAddressForWhiteListHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 패치 주소 */}
                <Controller
                  name="patchAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={
                        <Box component="span">
                          {t('clientVersions.patchAddress')} <Typography component="span" color="error">*</Typography>
                        </Box>
                      }
                      error={!!errors.patchAddress}
                      helperText={errors.patchAddress?.message || t('clientVersions.form.patchAddressHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 패치 주소 (화이트리스트용) */}
                <Controller
                  name="patchAddressForWhiteList"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('clientVersions.patchAddressForWhiteList')}
                      error={!!errors.patchAddressForWhiteList}
                      helperText={errors.patchAddressForWhiteList?.message || t('clientVersions.form.patchAddressForWhiteListHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />
              </Stack>
            </Paper>

            {/* 추가 설정 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                ⚙️ {t('clientVersions.form.additionalSettings')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.additionalSettingsDescription')}
              </Typography>

              <Stack spacing={2}>

                {/* 게스트 모드 허용 */}
                <Controller
                  name="guestModeAllowed"
                  control={control}
                  render={({ field }) => (
                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        }
                        label={t('clientVersions.guestModeAllowed')}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('clientVersions.form.guestModeAllowedHelp')}
                      </Typography>
                    </Box>
                  )}
                />

                {/* 외부 클릭 링크 */}
                <Controller
                  name="externalClickLink"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('clientVersions.externalClickLink')}
                      error={!!errors.externalClickLink}
                      helperText={errors.externalClickLink?.message || t('clientVersions.form.externalClickLinkHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 메모 */}
                <Controller
                  name="memo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label={t('clientVersions.memo')}
                      error={!!errors.memo}
                      helperText={errors.memo?.message || t('clientVersions.form.memoHelp')}
                    />
                  )}
                />

                {/* 커스텀 페이로드 */}
                <Controller
                  name="customPayload"
                  control={control}
                  render={({ field }) => (
                    <JsonEditor
                      value={field.value || '{}'}
                      onChange={(newValue) => {
                        field.onChange(newValue);
                      }}
                      height="200px"
                      label={t('clientVersions.customPayload')}
                      placeholder='{\n  "key": "value"\n}'
                      error={errors.customPayload?.message}
                      helperText={t('clientVersions.form.customPayloadHelp')}
                    />
                  )}
                />

                {/* 태그 선택 */}
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
                            <Chip
                              key={id}
                              label={tag.name}
                              size="small"
                              sx={{ bgcolor: tag.color, color: '#fff' }}
                            />
                          ) : null;
                        })}
                      </Box>
                    ),
                  }}
                  helperText={t('clientVersions.form.tagsHelp')}
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
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting || loading} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || loading || !!duplicateError}
            startIcon={displayIsCopy ? <CopyIcon /> : displayIsEdit ? <SaveIcon /> : <AddIcon />}
            onClick={() => {
              console.log('Submit button clicked!', {
                isSubmitting,
                loading,
                duplicateError,
                disabled: isSubmitting || loading || !!duplicateError,
                formErrors: errors,
                hasErrors: Object.keys(errors).length > 0
              });
            }}
          >
            {displayIsCopy
              ? t('common.copy')
              : displayIsEdit
                ? t('common.update')
                : t('common.add')
            }
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ClientVersionForm;
