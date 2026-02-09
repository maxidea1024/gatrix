/**
 * useJsonVariation - Get a JSON flag variation
 *
 * Returns the JSON payload value for a feature flag.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param defaultValue - Default value to return if flag not found or has no payload
 * @returns T - The variant payload as JSON object or default value
 *
 * @example
 * ```tsx
 * interface ThemeConfig {
 *   primary: string;
 *   secondary: string;
 *   fontSize: number;
 * }
 *
 * const defaultTheme: ThemeConfig = {
 *   primary: '#007bff',
 *   secondary: '#6c757d',
 *   fontSize: 14
 * };
 *
 * const theme = useJsonVariation<ThemeConfig>('theme-config', defaultTheme);
 *
 * return <App style={{ color: theme.primary, fontSize: theme.fontSize }} />;
 * ```
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS } from '@gatrix/js-client-sdk';

export function useJsonVariation<T>(flagName: string, defaultValue: T): T {
  const { features, client } = useGatrixContext();

  const getValue = useCallback(
    () => features.jsonVariation<T>(flagName, defaultValue),
    [features, flagName, defaultValue]
  );

  const [value, setValue] = useState<T>(() => getValue());
  const valueRef = useRef<T>(value);
  valueRef.current = value;

  useEffect(() => {
    if (!client) return;

    const updateHandler = () => {
      const newValue = getValue();
      // Deep comparison for objects
      if (JSON.stringify(newValue) !== JSON.stringify(valueRef.current)) {
        valueRef.current = newValue;
        setValue(newValue);
      }
    };

    const readyHandler = () => {
      const newValue = getValue();
      valueRef.current = newValue;
      setValue(newValue);
    };

    client.on(EVENTS.FLAGS_CHANGE, updateHandler);
    client.on(EVENTS.FLAGS_READY, readyHandler);

    return () => {
      client.off(EVENTS.FLAGS_CHANGE, updateHandler);
      client.off(EVENTS.FLAGS_READY, readyHandler);
    };
  }, [client, getValue]);

  return value;
}

export default useJsonVariation;
