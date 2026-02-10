/**
 * useStringVariation - Get a string flag variation
 *
 * Returns the string value for a feature flag.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param missingValue - Value to return if flag not found
 * @returns string - The variant value as string or missing value
 *
 * @example
 * ```tsx
 * const welcomeMessage = useStringVariation('welcome-message', 'Hello!');
 *
 * return <h1>{welcomeMessage}</h1>;
 * ```
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS } from '@gatrix/js-client-sdk';

export function useStringVariation(flagName: string, missingValue: string): string {
  const { features, client } = useGatrixContext();

  const getValue = useCallback(
    () => features.stringVariation(flagName, missingValue),
    [features, flagName, missingValue]
  );

  const [value, setValue] = useState<string>(() => getValue());
  const valueRef = useRef<string>(value);
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

export default useStringVariation;
