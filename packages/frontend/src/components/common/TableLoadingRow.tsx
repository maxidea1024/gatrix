import React from "react";
import { TableRow, TableCell, Box, CircularProgress } from "@mui/material";
import { DeferredLoading } from "./DeferredLoading";

interface TableLoadingRowProps {
  colSpan: number;
  loading: boolean;
  delay?: number;
}

export const TableLoadingRow: React.FC<TableLoadingRowProps> = ({
  colSpan,
  loading,
  delay = 200,
}) => {
  if (!loading) return null;

  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ height: 200 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <DeferredLoading loading={loading} delay={delay}>
            <CircularProgress />
          </DeferredLoading>
        </Box>
      </TableCell>
    </TableRow>
  );
};
