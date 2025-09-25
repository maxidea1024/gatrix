import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Divider
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { 
  CreateInvitationRequest, 
  InvitationDuration, 
  InvitationDurationLabels 
} from '../../types/invitation';

interface InvitationFormProps {
  onSubmit: (data: CreateInvitationRequest) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isDrawer?: boolean;
}

const InvitationForm: React.FC<InvitationFormProps> = ({
  onSubmit,
  onCancel,
  loading = false,
  isDrawer = false
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [expirationHours, setExpirationHours] = useState<number>(InvitationDuration.HOURS_48);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: CreateInvitationRequest = {
      expirationHours,
      ...(email.trim() && { email: email.trim() })
    };

    await onSubmit(data);
  };

  if (isDrawer) {
    return (
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Content - 스크롤 가능한 영역 */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}>
          <Alert severity="info">
            <Typography variant="body2">
              초대받은 사용자는 <strong>일반 유저</strong> 권한으로 가입됩니다.
              가입 후 필요시 관리자가 권한을 변경할 수 있습니다.
            </Typography>
          </Alert>

          <TextField
            label="이메일 (선택사항)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            helperText="이메일을 입력하지 않으면 링크만 생성됩니다."
            variant="outlined"
            autoFocus
          />

          <FormControl fullWidth>
            <InputLabel>유효기간</InputLabel>
            <Select
              value={expirationHours}
              label="유효기간"
              onChange={(e) => setExpirationHours(e.target.value as number)}
            >
              {Object.entries(InvitationDurationLabels).map(([value, label]) => (
                <MenuItem key={value} value={Number(value)}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 추가 공간을 위한 여백 */}
          <Box sx={{ minHeight: '200px' }} />
        </Box>

        {/* Footer */}
        <Box sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 2,
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={onCancel}
            startIcon={<CancelIcon />}
            variant="outlined"
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={loading}
          >
            초대 링크 생성
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          초대받은 사용자는 <strong>일반 유저</strong> 권한으로 가입됩니다.
          가입 후 필요시 관리자가 권한을 변경할 수 있습니다.
        </Typography>
      </Alert>

      <TextField
        label="이메일 (선택사항)"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        helperText="이메일을 입력하지 않으면 링크만 생성됩니다."
        variant="outlined"
        autoFocus
      />

      <FormControl fullWidth>
        <InputLabel>유효기간</InputLabel>
        <Select
          value={expirationHours}
          label="유효기간"
          onChange={(e) => setExpirationHours(e.target.value as number)}
        >
          {Object.entries(InvitationDurationLabels).map(([value, label]) => (
            <MenuItem key={value} value={Number(value)}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider />

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button
          onClick={onCancel}
          startIcon={<CancelIcon />}
          variant="outlined"
          disabled={loading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={<PersonAddIcon />}
          disabled={loading}
        >
          초대 링크 생성
        </Button>
      </Box>
    </Box>
  );
};

export default InvitationForm;
