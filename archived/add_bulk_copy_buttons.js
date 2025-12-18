const fs = require('fs');
const path = 'c:/github/admin-templates/gatrix/packages/frontend/src/pages/admin/ServerListPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Helper to create replacement string
const createReplacement = (originalContent, valueExpr) => {
    return originalContent.replace(
        /<Typography([^>]*)>\s*({[^}]*})\s*<\/Typography>/,
        (match, props, children) => {
            const checkExpr = valueExpr.startsWith('String') ? valueExpr.slice(7, -1) : valueExpr; // Extract variable for truthiness check

            // Logic: if value exists, copy it.
            const copyLogic = `if (${checkExpr}) copyToClipboardWithNotification(${valueExpr} as string, () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }), () => {})`;

            return `<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography${props}>
                          ${children}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => { ${copyLogic} }}
                          sx={{ opacity: 0.3, '&:hover': { opacity: 1 }, p: 0.5, visibility: ${checkExpr} ? 'visible' : 'hidden' }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>`;
        }
    );
};

// 1. Service (Note: indentations match the file content viewed in step 1967)
// <TableCell>\n<Typography ...>\n{item.service}\n</Typography>\n</TableCell>
const serviceRegex = /<TableCell>\s*<Typography variant="body2" fontWeight="medium">\s*{item\.service}\s*<\/Typography>\s*<\/TableCell>/;

// 2. Group
const groupRegex = /<TableCell>\s*<Typography variant="body2" color="text\.secondary">\s*{item\.group \|\| '-'}\s*<\/Typography>\s*<\/TableCell>/;

// 3. Env
const envRegex = /<TableCell>\s*<Typography variant="body2" color="text\.secondary">\s*{item\.env \|\| '-'}\s*<\/Typography>\s*<\/TableCell>/;

// 4. Hostname: uses D2Coding font style
const hostnameRegex = /<TableCell>\s*<Typography variant="body2" sx={{ fontFamily: 'D2Coding, monospace', fontSize: '0.75rem' }}>\s*{item\.hostname \|\| '-'}\s*<\/Typography>\s*<\/TableCell>/;

// 5. InternalIp
const internalIpRegex = /<TableCell>\s*<Typography variant="body2" sx={{ fontFamily: 'D2Coding, monospace', fontSize: '0.75rem' }}>\s*{item\.internalIp \|\| '-'}\s*<\/Typography>\s*<\/TableCell>/;

// 6. Port
const portRegex = /<TableCell>\s*<Typography variant="body2" sx={{ fontFamily: 'D2Coding, monospace', fontSize: '0.75rem' }}>\s*{item\.healthPort \|\| '-'}\s*<\/Typography>\s*<\/TableCell>/;

let modified = false;

// Apply replacements
if (serviceRegex.test(content)) {
    content = content.replace(serviceRegex, (match) => createReplacement(match, 'item.service'));
    modified = true;
} else console.log('Service regex failed');

if (groupRegex.test(content)) {
    content = content.replace(groupRegex, (match) => createReplacement(match, 'item.group'));
    modified = true;
} else console.log('Group regex failed');

if (envRegex.test(content)) {
    content = content.replace(envRegex, (match) => createReplacement(match, 'item.env'));
    modified = true;
} else console.log('Env regex failed');

if (hostnameRegex.test(content)) {
    content = content.replace(hostnameRegex, (match) => createReplacement(match, 'item.hostname'));
    modified = true;
} else console.log('Hostname regex failed');

if (internalIpRegex.test(content)) {
    content = content.replace(internalIpRegex, (match) => createReplacement(match, 'item.internalIp'));
    modified = true;
} else console.log('InternalIP regex failed');

if (portRegex.test(content)) {
    content = content.replace(portRegex, (match) => createReplacement(match, 'String(item.healthPort)'));
    modified = true;
} else console.log('Port regex failed');

if (modified) {
    fs.writeFileSync(path, content, 'utf8');
    console.log('Copy buttons added successfully');
} else {
    console.log('No changes made');
}
