const fs = require('fs');
const path = 'c:/github/admin-templates/gatrix/packages/frontend/src/pages/admin/ServerListPage.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Find the CheckerboardView component
    const viewStart = content.indexOf('const CheckerboardView: React.FC<CheckerboardViewProps>');
    if (viewStart === -1) {
        console.error('Could not find CheckerboardView component');
        process.exit(1);
    }

    // Find Tooltip inside CheckerboardView
    const tooltipStartMarker = '<Tooltip';
    const tooltipStart = content.indexOf(tooltipStartMarker, viewStart);
    if (tooltipStart === -1) {
        console.error('Could not find Tooltip inside CheckerboardView');
        process.exit(1);
    }

    // Find where Tooltip props end (before children)
    // We look for the closing '>' of the opening tag.
    // The children starts with <Box...
    const childrenStartMarker = '<Box';
    const childrenStart = content.indexOf(childrenStartMarker, tooltipStart);

    // Actually, we want to replace everything from <Tooltip ... up to the `title` prop ending.
    // But the existing code has `title={ <Box ... </Box> } >`
    // So the children <Box> is AFTER the opening tag of Tooltip.

    // Let's find the closing `>` of the Tooltip opening tag.   
    // In the existing code:
    // title={ ... } >
    //               <Box ...

    // So we can search for the first `>` after `title` prop.

    // Let's verify the uniqueness of the block we want to replace.
    // We want to replace from `<Tooltip` inside CheckerboardView
    // up to the `>` that closes the Tooltip opening tag.

    // We will construct the replacement string which includes the opening tag and all props including title.

    // Find the exact range to replace.
    // Start: tooltipStart
    // End: the index of `>` before the children <Box> (the click handler box)

    // To identify the start of children box:
    // It has `onContextMenu={(e) => onContextMenu(e, service)}`
    const clickHandlerBoxMarker = 'onContextMenu={(e) => onContextMenu(e, service)}';
    const clickHandlerBoxIndex = content.indexOf(clickHandlerBoxMarker, tooltipStart);

    if (clickHandlerBoxIndex === -1) {
        console.error('Could not find click handler box');
        process.exit(1);
    }

    // Find the `<Box` before the click handler.
    const childrenBoxStart = content.lastIndexOf('<Box', clickHandlerBoxIndex);

    // Find the `>` before `childrenBoxStart`. This `>` belongs to Tooltip opening tag.
    const tooltipOpenTagEnd = content.lastIndexOf('>', childrenBoxStart);

    // The replacement range is [tooltipStart, tooltipOpenTagEnd + 1]

    const replacement = `            <Tooltip
              key={serviceKey}
              arrow
              placement="top"
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: (theme) => theme.shadows[10],
                    border: 1,
                    borderColor: 'divider',
                    p: 0,
                    maxWidth: 'none',
                  }
                }
              }}
              title={
                <Box sx={{ p: 1.5, minWidth: 320 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DnsIcon sx={{ fontSize: 20 }} />
                      {service.labels.service}
                    </Typography>
                    <Chip 
                        label={t(\`serverList.status.\${String(service.status).replace('-', '')}\`) || service.status}
                        size="small"
                        color={service.status === 'ready' ? 'success' : service.status === 'error' ? 'error' : 'warning'}
                        variant="outlined" 
                        sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  <Table size="small" sx={{ '& td': { border: 0, py: 0.5, px: 0 } }}>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ width: 100, color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>{t('serverList.table.instanceId')}</TableCell>
                        <TableCell sx={{ fontFamily: '"D2Coding", monospace', fontWeight: 600, fontSize: '0.75rem', color: 'text.primary' }}>{service.instanceId}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>{t('serverList.table.hostname')}</TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.75rem' }}>{service.hostname}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>Address (Ext)</TableCell>
                        <TableCell sx={{ fontFamily: '"D2Coding", monospace', fontSize: '0.75rem' }}>{service.externalAddress}</TableCell>
                      </TableRow>
                      <TableRow>
                         <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>Address (Int)</TableCell>
                         <TableCell sx={{ fontFamily: '"D2Coding", monospace', fontSize: '0.75rem' }}>{service.internalAddress}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>{t('serverList.table.updatedAt')}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <RelativeTime date={service.updatedAt} variant="caption" />
                            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                              ({formatDateTimeDetailed(service.updatedAt)})
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              }`;

    const newContent = content.substring(0, tooltipStart) + replacement + content.substring(tooltipOpenTagEnd + 1);

    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Successfully replaced tooltip in CheckerboardView.');

} catch (err) {
    console.error('Error:', err);
    process.exit(1);
}
