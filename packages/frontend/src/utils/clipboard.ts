/**
 * Clipboard utility with fallback support for non-HTTPS environments
 */

/**
 * Copy text to clipboard with fallback for non-HTTPS environments
 * @param text - Text to copy
 * @returns Promise that resolves when copy is successful
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  console.log('[Clipboard] Starting copy, text length:', text.length);

  // Try modern Clipboard API first (HTTPS/localhost only)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      console.log('[Clipboard] Trying modern Clipboard API...');
      await navigator.clipboard.writeText(text);
      console.log('[Clipboard] ✓ Modern Clipboard API success');
      return true;
    } catch (error) {
      console.warn('[Clipboard] Modern Clipboard API failed, trying fallback:', error);
    }
  }

  // Fallback method for non-HTTPS environments or if modern API fails
  try {
    console.log('[Clipboard] Using fallback method (execCommand)...');
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Ensure the textarea is not visible but still part of the DOM
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';

    document.body.appendChild(textArea);

    // Select and copy
    textArea.focus();
    textArea.select();

    // Some browsers require explicit selection range for better compatibility
    textArea.setSelectionRange(0, 99999);

    const successful = document.execCommand('copy');

    // Clean up
    document.body.removeChild(textArea);

    if (successful) {
      console.log('[Clipboard] ✓ Fallback method success');
      return true;
    } else {
      console.error('[Clipboard] execCommand copy failed');
      return false;
    }
  } catch (error) {
    console.error('[Clipboard] Fallback clipboard copy failed:', error);
    return false;
  }
};

/**
 * Copy text to clipboard and show snackbar notification
 * @param text - Text to copy
 * @param onSuccess - Callback when copy is successful
 * @param onError - Callback when copy fails
 */
export const copyToClipboardWithNotification = async (
  text: string,
  onSuccess: () => void,
  onError: () => void
): Promise<void> => {
  console.log('[ClipboardNotification] Starting copy with notification');
  try {
    const success = await copyToClipboard(text);
    console.log('[ClipboardNotification] Copy result:', success);
    if (success) {
      console.log('[ClipboardNotification] Calling onSuccess');
      onSuccess();
    } else {
      console.log('[ClipboardNotification] Calling onError - copy failed');
      onError();
    }
  } catch (error) {
    console.error('[ClipboardNotification] Copy to clipboard error:', error);
    onError();
  }
};

