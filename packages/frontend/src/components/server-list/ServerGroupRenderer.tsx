import React from "react";
import { Box, Paper, Chip, Typography, alpha } from "@mui/material";
import { ServiceInstance } from "../../../services/serviceDiscoveryService";
import {
  ServerGroup,
  GroupingField,
  collectAllInstances,
  ServiceStatus,
} from "./types";

interface StatusStatsProps {
  services: ServiceInstance[];
  t: (key: string) => string;
}

// Helper component for status statistics
export const StatusStatsDisplay: React.FC<StatusStatsProps> = ({
  services,
  t,
}) => {
  const statusCounts = React.useMemo(() => {
    const counts = {
      initializing: 0,
      ready: 0,
      shuttingDown: 0,
      terminated: 0,
      error: 0,
      noResponse: 0,
    };
    services.forEach((service) => {
      const status = service.status;
      if (status === "initializing") counts.initializing++;
      else if (status === "ready") counts.ready++;
      else if (status === "shuttingDown" || status === "shutting_down")
        counts.shuttingDown++;
      else if (status === "terminated") counts.terminated++;
      else if (status === "error") counts.error++;
      else if (status === "noResponse" || status === "no_response")
        counts.noResponse++;
    });
    return counts;
  }, [services]);

  return (
    <Box sx={{ display: "flex", gap: 0.5 }}>
      {statusCounts.ready > 0 && (
        <Chip
          label={`${t("serverList.stats.ready")}: ${statusCounts.ready}`}
          size="small"
          color="success"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
      )}
      {statusCounts.initializing > 0 && (
        <Chip
          label={`${t("serverList.stats.initializing")}: ${statusCounts.initializing}`}
          size="small"
          color="info"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
      )}
      {statusCounts.shuttingDown > 0 && (
        <Chip
          label={`${t("serverList.stats.shuttingDown")}: ${statusCounts.shuttingDown}`}
          size="small"
          color="warning"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
      )}
      {statusCounts.error > 0 && (
        <Chip
          label={`${t("serverList.stats.error")}: ${statusCounts.error}`}
          size="small"
          color="error"
          variant="outlined"
          sx={{ height: 20, fontSize: "0.7rem" }}
        />
      )}
    </Box>
  );
};

interface ServerGroupHeaderProps {
  group: ServerGroup;
  getGroupingLabel: (field: GroupingField) => string;
  t: (key: string) => string;
}

// Group header component
export const ServerGroupHeader: React.FC<ServerGroupHeaderProps> = ({
  group,
  getGroupingLabel,
  t,
}) => {
  const allInstances = collectAllInstances(group);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        mb: 2,
        gap: 1.5,
        pb: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          height: 32,
          borderRadius: 1,
          border: 1,
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1,
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "text.secondary",
            bgcolor: (theme) => alpha(theme.palette.divider, 0.5),
          }}
        >
          {getGroupingLabel(group.fieldName)}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1.5,
            fontSize: "0.9rem",
            fontWeight: 700,
            color: (theme) =>
              theme.palette.mode === "dark"
                ? theme.palette.grey[900]
                : theme.palette.grey[100],
            bgcolor: (theme) =>
              theme.palette.mode === "dark"
                ? theme.palette.grey[200]
                : theme.palette.grey[700],
          }}
        >
          {group.name}
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 32,
            px: 1,
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "primary.contrastText",
            bgcolor: "primary.main",
          }}
        >
          {allInstances.length}
        </Box>
      </Box>
      <Box sx={{ flex: 1 }} />
      <StatusStatsDisplay services={allInstances} t={t} />
    </Box>
  );
};

interface ServerGroupContainerProps {
  group: ServerGroup;
  depth: number;
  getGroupingLabel: (field: GroupingField) => string;
  t: (key: string) => string;
  renderContent: (instances: ServiceInstance[]) => React.ReactNode;
  renderChildren?: (group: ServerGroup, depth: number) => React.ReactNode;
}

// Group container with Paper wrapper
export const ServerGroupContainer: React.FC<ServerGroupContainerProps> = ({
  group,
  depth,
  getGroupingLabel,
  t,
  renderContent,
  renderChildren,
}) => {
  const hasChildren = group.children && group.children.length > 0;

  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        boxSizing: "border-box",
        mb: depth === 0 ? 3 : 2,
        ml: depth * 2,
        p: depth === 0 ? 2.5 : 2,
        bgcolor: (theme) =>
          alpha(theme.palette.background.paper, depth === 0 ? 0.4 : 0.6),
        borderRadius: 2,
        backdropFilter: "blur(8px)",
        boxShadow: (theme) =>
          theme.palette.mode === "dark"
            ? `0 ${4 - depth}px ${20 - depth * 5}px rgba(0,0,0,${0.4 - depth * 0.1})`
            : `0 ${4 - depth}px ${20 - depth * 5}px rgba(0,0,0,${0.05 - depth * 0.01})`,
        borderLeft: depth > 0 ? 3 : 0,
        borderColor: "primary.main",
      }}
    >
      <ServerGroupHeader
        group={group}
        getGroupingLabel={getGroupingLabel}
        t={t}
      />
      {hasChildren && renderChildren ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {group.children!.map((child) => renderChildren(child, depth + 1))}
        </Box>
      ) : (
        renderContent(group.instances)
      )}
    </Paper>
  );
};
