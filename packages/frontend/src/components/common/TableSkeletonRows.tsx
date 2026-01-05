import React from 'react';
import { TableRow, TableCell, Skeleton } from '@mui/material';
import { DeferredLoading } from './DeferredLoading';

interface TableSkeletonRowsProps {
    rowCount?: number;
    cellCount: number;
    loading: boolean;
    delay?: number;
}

export const TableSkeletonRows: React.FC<TableSkeletonRowsProps> = ({
    rowCount = 5,
    cellCount,
    loading,
    delay = 200,
}) => {
    if (!loading) return null;

    return (
        <DeferredLoading loading={loading} delay={delay}>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`}>
                    {Array.from({ length: cellCount }).map((_, cellIndex) => (
                        <TableCell key={`skeleton-cell-${cellIndex}`}>
                            <Skeleton
                                variant="rectangular"
                                animation="wave"
                                height={24}
                                sx={{ borderRadius: 1 }}
                            />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </DeferredLoading>
    );
};
