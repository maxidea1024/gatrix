import React from "react";
import { Box, Typography } from "@mui/material";
import { Whatshot as WhatshotIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

const HotTimeButtonEventPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <WhatshotIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t("hotTimeButtonEvent.title")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("hotTimeButtonEvent.subtitle")}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Content will be added here */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t("common.comingSoon")}
        </Typography>
      </Box>
    </Box>
  );
};

export default HotTimeButtonEventPage;
