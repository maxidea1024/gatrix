import React, { useState } from "react";
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
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { WhitelistService } from "../../services/whitelistService";

interface WhitelistTestResult {
  isAllowed: boolean;
  matchedRules: Array<{
    type: "account" | "ip";
    rule: string;
    reason: string;
  }>;
}

const WhitelistOverview: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Test state
  const [testAccountId, setTestAccountId] = useState("");
  const [testIpAddress, setTestIpAddress] = useState("");
  const [testResult, setTestResult] = useState<WhitelistTestResult | null>(
    null,
  );
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!testAccountId && !testIpAddress) {
      enqueueSnackbar(t("whitelist.overview.testWarning"), {
        variant: "warning",
      });
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
      console.error("Failed to test whitelist:", error);
      enqueueSnackbar(t("whitelist.overview.testFailed"), { variant: "error" });
    } finally {
      setTesting(false);
    }
  };

  // 초기화 함수
  const handleReset = () => {
    setTestAccountId("");
    setTestIpAddress("");
    setTestResult(null);
  };

  return (
    <Box>
      {/* Whitelist Test */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 3 }}>
            {t("whitelist.overview.testTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("whitelist.overview.testDescription")}
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label={t("whitelist.overview.testAccountId")}
                value={testAccountId}
                onChange={(e) => setTestAccountId(e.target.value)}
                placeholder="예: 28004430"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label={t("whitelist.overview.testIpAddress")}
                value={testIpAddress}
                onChange={(e) => setTestIpAddress(e.target.value)}
                placeholder="예: 127.0.0.1"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleTest}
                disabled={testing || (!testAccountId && !testIpAddress)}
                startIcon={
                  testing ? <CircularProgress size={20} /> : <SearchIcon />
                }
                sx={{ height: "56px" }}
              >
                {testing
                  ? t("common.testing")
                  : t("whitelist.overview.testButton")}
              </Button>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleReset}
                disabled={testing}
                sx={{ height: "56px" }}
              >
                {t("common.reset")}
              </Button>
            </Grid>
          </Grid>

          {testResult && (
            <Alert
              severity={testResult.isAllowed ? "success" : "error"}
              icon={testResult.isAllowed ? <CheckCircleIcon /> : <CancelIcon />}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                {testResult.isAllowed
                  ? t("whitelist.overview.testAllowed")
                  : t("whitelist.overview.testDenied")}
              </Typography>
            </Alert>
          )}

          {testResult && testResult.matchedRules.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t("whitelist.overview.matchedRules")}:
              </Typography>
              {testResult.matchedRules.map((rule, index) => (
                <Chip
                  key={index}
                  label={`${rule.type === "account" ? t("whitelist.overview.accountRule") : t("whitelist.overview.ipRule")}: ${rule.rule}`}
                  color={rule.type === "account" ? "primary" : "secondary"}
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
