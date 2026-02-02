import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Stack,
} from "@mui/material";
import {
  ErrorOutline as ErrorIcon,
  Login as LoginIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { AuthService } from "@/services/auth";

/**
 * Session Expired Page
 *
 * Displayed when:
 * - User's account was deleted while they were logged in
 * - Server was reset and user data was cleared
 * - Token is valid but user no longer exists in database
 *
 * This page:
 * - Clears all authentication data from localStorage
 * - Shows a clear message to the user
 * - Provides a button to return to login page
 */
const SessionExpiredPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    // Clear all authentication data when this page loads
    AuthService.clearAuthData();
  }, []);

  const handleBackToLogin = () => {
    navigate("/login", { replace: true });
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={24}
          sx={{
            padding: { xs: 3, sm: 5 },
            borderRadius: 0,
            textAlign: "center",
          }}
        >
          <Stack spacing={3} alignItems="center">
            {/* Error Icon */}
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: "error.light",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1,
              }}
            >
              <ErrorIcon
                sx={{
                  fontSize: 48,
                  color: "error.main",
                }}
              />
            </Box>

            {/* Title */}
            <Typography
              variant="h4"
              component="h1"
              fontWeight="bold"
              color="text.primary"
            >
              {t("auth.sessionExpired.title")}
            </Typography>

            {/* Description */}
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 400 }}
            >
              {t("auth.sessionExpired.description")}
            </Typography>

            {/* Additional Info */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                maxWidth: 400,
                backgroundColor: "grey.100",
                padding: 2,
                borderRadius: 0,
                borderLeft: 4,
                borderColor: "warning.main",
              }}
            >
              {t("auth.sessionExpired.reason")}
            </Typography>

            {/* Back to Login Button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              onClick={handleBackToLogin}
              sx={{
                mt: 2,
                paddingX: 4,
                paddingY: 1.5,
                borderRadius: 0,
                textTransform: "none",
                fontSize: "1rem",
                fontWeight: 600,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)",
                },
              }}
            >
              {t("auth.sessionExpired.backToLogin")}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default SessionExpiredPage;
