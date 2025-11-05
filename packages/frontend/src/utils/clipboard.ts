/**
 * Clipboard utility with fallback support for non-HTTPS environments
 */

/**
 * Copy text to clipboard with fallback for non-HTTPS environments
 * @param text - Text to copy
 * @returns Promise that resolves when copy is successful
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // Try modern Clipboard API first (HTTPS/localhost only)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error);
      // Fall through to fallback method
    }
  }

  // Fallback method for non-HTTPS environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);

    // Select and copy
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');

    // Clean up
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    } else {
      console.error('execCommand copy failed');
      return false;
    }
  } catch (error) {
    console.error('Fallback clipboard copy failed:', error);
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
  try {
    const success = await copyToClipboard(text);
    if (success) {
      onSuccess();
    } else {
      onError();
    }
  } catch (error) {
    console.error('Copy to clipboard error:', error);
    onError();
  }
};

