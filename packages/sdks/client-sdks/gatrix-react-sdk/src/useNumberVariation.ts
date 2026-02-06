/**
 * useNumberVariation - Get a number flag variation
 *
 * Returns the number payload value for a feature flag.
 * Automatically updates when the flag value changes.
 *
 * @param flagName - The name of the feature flag
 * @param defaultValue - Default value to return if flag not found or has no payload
 * @returns number - The variant payload as number or default value
 *
 * @example
 * ```tsx
 * const maxItems = useNumberVariation('max-items', 10);
 *
 * return <List items={items.slice(0, maxItems)} />;
 * ```
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useGatrixContext } from './useGatrixContext';
import { EVENTS } from '@gatrix/js-client-sdk';

export function useNumberVariation(flagName: string, defaultValue: number): number {
    const { features, client } = useGatrixContext();

    const getValue = useCallback(
        () => features.numberVariation(flagName, defaultValue),
        [features, flagName, defaultValue]
    );

    const [value, setValue] = useState<number>(() => getValue());
    const valueRef = useRef<number>(value);
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

export default useNumberVariation;
