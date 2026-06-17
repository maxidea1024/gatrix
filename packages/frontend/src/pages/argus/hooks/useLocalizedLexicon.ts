import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * Hook that provides localization helpers for reserved Lexicon events & properties.
 *
 * For reserved (system) items, display_name and description are translated via i18n.
 * For custom items, the DB values are used as-is.
 *
 * i18n key patterns:
 *   argus.lexicon.events.<event_name>.displayName
 *   argus.lexicon.events.<event_name>.description
 *   argus.lexicon.properties.<property_name>.displayName
 *   argus.lexicon.properties.<property_name>.description
 */
export function useLocalizedLexicon() {
  const { t } = useTranslation();

  /** Returns localized display_name for an event */
  const localizeEventName = useCallback(
    (eventName: string, dbDisplayName: string | null, isReserved: boolean): string => {
      if (isReserved) {
        // Strip leading $ for the key
        const key = eventName.startsWith('$') ? eventName.slice(1) : eventName;
        const i18nKey = `argus.lexicon.events.${key}.displayName`;
        const translated = t(i18nKey, '');
        if (translated) return translated;
      }
      return dbDisplayName || eventName;
    },
    [t]
  );

  /** Returns localized description for an event */
  const localizeEventDescription = useCallback(
    (eventName: string, dbDescription: string | null, isReserved: boolean): string | null => {
      if (isReserved) {
        const key = eventName.startsWith('$') ? eventName.slice(1) : eventName;
        const i18nKey = `argus.lexicon.events.${key}.description`;
        const translated = t(i18nKey, '');
        if (translated) return translated;
      }
      return dbDescription;
    },
    [t]
  );

  /** Returns localized display_name for a property */
  const localizePropertyName = useCallback(
    (propertyName: string, dbDisplayName: string | null, isReserved: boolean): string => {
      if (isReserved) {
        const key = propertyName.startsWith('$') ? propertyName.slice(1) : propertyName;
        const i18nKey = `argus.lexicon.properties.${key}.displayName`;
        const translated = t(i18nKey, '');
        if (translated) return translated;
      }
      return dbDisplayName || propertyName;
    },
    [t]
  );

  /** Returns localized description for a property */
  const localizePropertyDescription = useCallback(
    (propertyName: string, dbDescription: string | null, isReserved: boolean): string | null => {
      if (isReserved) {
        const key = propertyName.startsWith('$') ? propertyName.slice(1) : propertyName;
        const i18nKey = `argus.lexicon.properties.${key}.description`;
        const translated = t(i18nKey, '');
        if (translated) return translated;
      }
      return dbDescription;
    },
    [t]
  );

  return {
    localizeEventName,
    localizeEventDescription,
    localizePropertyName,
    localizePropertyDescription,
  };
}
