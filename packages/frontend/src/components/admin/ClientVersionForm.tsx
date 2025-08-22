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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  ClientVersion,
  ClientVersionFormData,
  ClientStatus,
  ClientStatusLabels,
  CLIENT_VERSION_VALIDATION,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';

interface ClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientVersion?: ClientVersion | null;
  isCopyMode?: boolean;
  channels: string[];
  subChannels: string[];
}

// 폼 유효성 검사 스키마
const createValidationSchema = (t: any) => yup.object({
  channel: yup
    .string()
    .required(t('clientVersions.form.channelRequired'))
    .min(CLIENT_VERSION_VALIDATION.CHANNEL.MIN_LENGTH)
    .max(CLIENT_VERSION_VALIDATION.CHANNEL.MAX_LENGTH),
  subChannel: yup
    .string()
    .required(t('clientVersions.form.subChannelRequired'))
    .min(CLIENT_VERSION_VALIDATION.SUB_CHANNEL.MIN_LENGTH)
    .max(CLIENT_VERSION_VALIDATION.SUB_CHANNEL.MAX_LENGTH),
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
    .required(),
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

  // 기본값 설정
  const defaultValues: ClientVersionFormData = {
    channel: '',
    subChannel: '',
    clientVersion: '',
    clientStatus: ClientStatus.OFFLINE,
    gameServerAddress: '',
    gameServerAddressForWhiteList: '',
    patchAddress: '',
    patchAddressForWhiteList: '',
    guestModeAllowed: false,
    externalClickLink: '',
    memo: '',
    customPayload: '',
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
      if (clientVersion) {
        // 편집 모드 또는 복사 모드일 때 기존 데이터로 초기화
        console.log('Initializing form with clientVersion data:', {
          isEdit,
          isCopyMode,
          clientVersion
        });

        reset({
          channel: clientVersion.channel,
          subChannel: clientVersion.subChannel,
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
        });
      } else {
        // 새로 생성할 때 기본값으로 초기화
        console.log('Initializing form with default values');
        reset(defaultValues);
      }
      setDuplicateError(null);

      // 복사 모드일 때 버전 필드에 포커스
      if (isCopyMode) {
        setTimeout(() => {
          versionFieldRef.current?.focus();
        }, 100);
      }
    }
  }, [open, isEdit, isCopyMode, clientVersion, reset]);

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

      // 빈 문자열을 undefined로 변환
      const cleanedData = {
        ...data,
        gameServerAddressForWhiteList: data.gameServerAddressForWhiteList || undefined,
        patchAddressForWhiteList: data.patchAddressForWhiteList || undefined,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
      };

      console.log('Cleaned data to send:', cleanedData);

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
        enqueueSnackbar(t('clientVersions.updateSuccess'), { variant: 'success' });
      } else {
        console.log('Creating new client version (copy mode or new):', {
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion
        });
        console.log('About to call createClientVersion API...');
        await ClientVersionService.createClientVersion(cleanedData);
        console.log('createClientVersion API call completed');
        enqueueSnackbar(t('clientVersions.createSuccess'), { variant: 'success' });
      }

      console.log('Form submission successful');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving client version:', error);
      enqueueSnackbar(error.message || 'Failed to save client version', { variant: 'error' });
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
        {isCopyMode
          ? t('clientVersions.form.copyTitle')
          : isEdit
            ? t('clientVersions.form.editTitle')
            : t('clientVersions.form.title')
        }
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.log('Form validation failed:', errors);
      })}>
        <DialogContent dividers>
          {duplicateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {duplicateError}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            {/* 기본 정보 */}
            <Typography variant="h6" gutterBottom>
              {t('clientVersions.form.basicInfo')}
            </Typography>

            <Controller
              name="channel"
              control={control}
              render={({ field }) => (
                <Box>
                  <FormControl fullWidth error={!!errors.channel}>
                    <InputLabel>{t('clientVersions.channel')}</InputLabel>
                    <Select
                      {...field}
                      label={t('clientVersions.channel')}
                    >
                      {channels.map((channel) => (
                        <MenuItem key={channel} value={channel}>
                          {channel}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.channel && (
                      <Typography variant="caption" color="error">
                        {errors.channel.message}
                      </Typography>
                    )}
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.channelHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="subChannel"
              control={control}
              render={({ field }) => (
                <Box>
                  <FormControl fullWidth error={!!errors.subChannel}>
                    <InputLabel>{t('clientVersions.subChannel')}</InputLabel>
                    <Select
                      {...field}
                      label={t('clientVersions.subChannel')}
                    >
                      {subChannels.map((subChannel) => (
                        <MenuItem key={subChannel} value={subChannel}>
                          {subChannel}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.subChannel && (
                      <Typography variant="caption" color="error">
                        {errors.subChannel.message}
                      </Typography>
                    )}
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.subChannelHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="clientVersion"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    inputRef={versionFieldRef}
                    fullWidth
                    label={t('clientVersions.version')}
                    placeholder={CLIENT_VERSION_VALIDATION.CLIENT_VERSION.EXAMPLE}
                    error={!!errors.clientVersion}
                    helperText={errors.clientVersion?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.versionHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="clientStatus"
              control={control}
              render={({ field }) => (
                <Box>
                  <FormControl fullWidth>
                    <InputLabel>{t('clientVersions.statusLabel')}</InputLabel>
                    <Select
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

            {/* 서버 주소 */}
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              {t('clientVersions.form.serverAddresses')}
            </Typography>

            <Controller
              name="gameServerAddress"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.gameServerAddress')}
                    error={!!errors.gameServerAddress}
                    helperText={errors.gameServerAddress?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.gameServerAddressHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="gameServerAddressForWhiteList"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.gameServerAddressForWhiteList')}
                    error={!!errors.gameServerAddressForWhiteList}
                    helperText={errors.gameServerAddressForWhiteList?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.gameServerAddressForWhiteListHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="patchAddress"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.patchAddress')}
                    error={!!errors.patchAddress}
                    helperText={errors.patchAddress?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.patchAddressHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="patchAddressForWhiteList"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    label={t('clientVersions.patchAddressForWhiteList')}
                    error={!!errors.patchAddressForWhiteList}
                    helperText={errors.patchAddressForWhiteList?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.patchAddressForWhiteListHelp')}
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
                    multiline
                    rows={3}
                    label={t('clientVersions.memo')}
                    error={!!errors.memo}
                    helperText={errors.memo?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.memoHelp')}
                  </Typography>
                </Box>
              )}
            />

            <Controller
              name="customPayload"
              control={control}
              render={({ field }) => (
                <Box>
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={4}
                    label={t('clientVersions.customPayload')}
                    placeholder="JSON 형식으로 입력하세요"
                    error={!!errors.customPayload}
                    helperText={errors.customPayload?.message}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {t('clientVersions.form.customPayloadHelp')}
                  </Typography>
                </Box>
              )}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting || loading}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || loading || !!duplicateError}
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
            {isCopyMode
              ? t('common.copy')
              : isEdit
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
