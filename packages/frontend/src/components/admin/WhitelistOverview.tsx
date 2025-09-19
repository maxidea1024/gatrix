import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { WhitelistService } from '../../services/whitelistService';

interface WhitelistTestResult {
  isAllowed: boolean;
  matchedRules: Array<{
    type: 'account' | 'ip';
    rule: string;
    reason: string;
  }>;
}

const WhitelistOverview: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  // Test state
  const [testAccountId, setTestAccountId] = useState('');
  const [testIpAddress, setTestIpAddress] = useState('');
  const [testResult, setTestResult] = useState<WhitelistTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!testAccountId && !testIpAddress) {
      enqueueSnackbar('계정 ID 또는 IP 주소 중 하나는 입력해야 합니다.', { variant: 'warning' });
      return;
    }

    try {
      setTesting(true);
      const result = await WhitelistService.testWhitelist({
        accountId: testAccountId || undefined,
        ipAddress: testIpAddress || undefined,
      });
      setTestResult(result);
    } catch (error) {
      console.error('Failed to test whitelist:', error);
      enqueueSnackbar('화이트리스트 테스트에 실패했습니다.', { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  // 초기화 함수
  const handleReset = () => {
    setTestAccountId('');
    setTestIpAddress('');
    setTestResult(null);
  };

  return (
    <Box>
      {/* 화이트리스트 테스트 */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3 }}>
            화이트리스트 테스트
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            계정 ID나 IP 주소를 입력하여 화이트리스트 접근 권한을 테스트할 수 있습니다.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid xs={12} md={3}>
              <TextField
                fullWidth
                label="테스트 계정 ID"
                value={testAccountId}
                onChange={(e) => setTestAccountId(e.target.value)}
                placeholder="예: 28004430"
              />
            </Grid>
            <Grid xs={12} md={3}>
              <TextField
                fullWidth
                label="테스트 IP 주소"
                value={testIpAddress}
                onChange={(e) => setTestIpAddress(e.target.value)}
                placeholder="예: 127.0.0.1"
              />
            </Grid>
            <Grid xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleTest}
                disabled={testing || (!testAccountId && !testIpAddress)}
                startIcon={testing ? <CircularProgress size={20} /> : <SearchIcon />}
                sx={{ height: '56px' }}
              >
                {testing ? '테스트 중...' : '테스트 실행'}
              </Button>
            </Grid>
            <Grid xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleReset}
                disabled={testing}
                sx={{ height: '56px' }}
              >
                초기화
              </Button>
            </Grid>
          </Grid>

          {testResult && (
            <Alert
              severity={testResult.isAllowed ? 'success' : 'error'}
              icon={testResult.isAllowed ? <CheckCircleIcon /> : <CancelIcon />}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                {testResult.isAllowed
                  ? '접근이 허용됩니다'
                  : '접근이 거부됩니다'
                }
              </Typography>
            </Alert>
          )}

          {testResult && testResult.matchedRules.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                일치하는 규칙:
              </Typography>
              {testResult.matchedRules.map((rule, index) => (
                <Chip
                  key={index}
                  label={`${rule.type === 'account' ? '계정 규칙' : 'IP 규칙'}: ${rule.rule}`}
                  color={rule.type === 'account' ? 'primary' : 'secondary'}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default WhitelistOverview;
