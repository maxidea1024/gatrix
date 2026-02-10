/**
 * useBoolVariation - Get a boolean flag variation
 *
 * Returns the boolean value for a feature flag (its enabled state).
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param missingValue - Value to return if flag not found
 * @returns boolean - The flag's enabled state or missing value
 *
 * @example
 * ```tsx
 * const darkMode = useBoolVariation('dark-mode', false);
 *
 * return <App theme={darkMode ? 'dark' : 'light'} />;
 * ```
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS } from '@gatrix/js-client-sdk';

export function useBoolVariation(flagName: string, missingValue: boolean): boolean {
  const { features, client } = useGatrixContext();

  const getValue = useCallback(
    () => features.boolVariation(flagName, missingValue),
    [features, flagName, missingValue]
  );

  const [value, setValue] = useState<boolean>(() => getValue());
  const valueRef = useRef<boolean>(value);
  valueRef.current = value;

  useEffect(() => {
    if (!client) return;

    const updateHandler = () => {
      const newValue = getValue();
      if (newValue !== valueRef.current) {
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

export default useBoolVariation;
