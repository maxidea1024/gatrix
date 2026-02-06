/**
 * useStringVariation - Get a string flag variation
 *
 * Returns the string payload value for a feature flag.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param defaultValue - Default value to return if flag not found or has no payload
 * @returns string - The variant payload as string or default value
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

export function useStringVariation(flagName: string, defaultValue: string): string {
    const { features, client } = useGatrixContext();

    const getValue = useCallback(
        () => features.stringVariation(flagName, defaultValue),
        [features, flagName, defaultValue]
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

        client.on(EVENTS.UPDATE, updateHandler);
        client.on(EVENTS.READY, readyHandler);

        return () => {
            client.off(EVENTS.UPDATE, updateHandler);
            client.off(EVENTS.READY, readyHandler);
        };
    }, [client, getValue]);

    return value;
}

export default useStringVariation;
