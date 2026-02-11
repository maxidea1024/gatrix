/**
 * CountrySelect - Autocomplete component for selecting countries
 * Displays flag images from flagcdn.com alongside country names
 */
import React from 'react';
import { Autocomplete, TextField, Box, Typography, Chip, AutocompleteProps } from '@mui/material';
import { COUNTRIES, Country, getFlagUrl, getCountryByCode } from '../../utils/countries';

interface CountrySelectProps {
    value: string | string[] | null;
    onChange: (value: string | string[] | null) => void;
    multiple?: boolean;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    size?: 'small' | 'medium';
    fullWidth?: boolean;
    helperText?: string;
    error?: boolean;
}

/**
 * Renders a flag image for a country code
 */
export const FlagImage: React.FC<{ code: string; size?: number }> = ({ code, size = 20 }) => (
    <img
        loading="lazy"
        width={size}
        src={getFlagUrl(code, size * 2)} // Request 2x for retina; getFlagUrl maps to nearest supported CDN width
        alt={code.toUpperCase()}
        style={{
            borderRadius: 2,
            objectFit: 'cover',
            flexShrink: 0,
            border: '1px solid rgba(0,0,0,0.08)',
        }}
    />
);

/**
 * Renders a country chip with flag for multi-select mode
 */
const CountryChip: React.FC<{
    code: string;
    onDelete?: () => void;
    disabled?: boolean;
}> = ({ code, onDelete, disabled }) => {
    const country = getCountryByCode(code);
    return (
        <Chip
            size="small"
            icon={<FlagImage code={code} size={16} />}
            label={country ? `${country.name} (${code.toUpperCase()})` : code.toUpperCase()}
            onDelete={onDelete}
            disabled={disabled}
            sx={{
                m: '2px',
                '& .MuiChip-icon': {
                    ml: 0.5,
                },
            }}
        />
    );
};

const CountrySelect: React.FC<CountrySelectProps> = ({
    value,
    onChange,
    multiple = false,
    label,
    placeholder,
    disabled = false,
    size = 'small',
    fullWidth = true,
    helperText,
    error,
}) => {
    // Convert string value(s) to Country object(s) for Autocomplete
    const getSelectedCountries = (): Country | Country[] | null => {
        if (multiple) {
            const codes = Array.isArray(value) ? value : value ? [value] : [];
            return codes
                .map((code) => getCountryByCode(code))
                .filter((c): c is Country => c !== undefined);
        }
        if (!value || Array.isArray(value)) return null;
        return getCountryByCode(value) || null;
    };

    if (multiple) {
        return (
            <Autocomplete
                multiple
                options={COUNTRIES}
                value={getSelectedCountries() as Country[]}
                onChange={(_, newValue) => {
                    onChange((newValue as Country[]).map((c) => c.code.toUpperCase()));
                }}
                getOptionLabel={(option) => `${option.name} (${option.code.toUpperCase()})`}
                isOptionEqualToValue={(option, val) => option.code === val.code}
                disabled={disabled}
                size={size}
                fullWidth={fullWidth}
                filterOptions={(options, { inputValue }) => {
                    const search = inputValue.toLowerCase();
                    return options.filter(
                        (o) =>
                            o.name.toLowerCase().includes(search) ||
                            o.native.toLowerCase().includes(search) ||
                            o.code.includes(search)
                    );
                }}
                renderOption={(props, option) => {
                    const { key, ...restProps } = props as any;
                    return (
                        <Box
                            component="li"
                            key={key}
                            {...restProps}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}
                        >
                            <FlagImage code={option.code} size={24} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" noWrap>
                                    {option.name}
                                </Typography>
                                {option.native !== option.name && (
                                    <Typography variant="caption" color="text.secondary" noWrap>
                                        {option.native}
                                    </Typography>
                                )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                {option.code.toUpperCase()}
                            </Typography>
                        </Box>
                    );
                }}
                renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                        const { key, ...restTagProps } = getTagProps({ index });
                        return (
                            <CountryChip
                                key={key}
                                code={option.code}
                                onDelete={restTagProps.onDelete}
                                disabled={disabled}
                            />
                        );
                    })
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder={placeholder}
                        helperText={helperText}
                        error={error}
                    />
                )}
            />
        );
    }

    // Single select
    return (
        <Autocomplete
            options={COUNTRIES}
            value={getSelectedCountries() as Country | null}
            onChange={(_, newValue) => {
                onChange(newValue ? (newValue as Country).code.toUpperCase() : null);
            }}
            getOptionLabel={(option) => `${option.name} (${option.code.toUpperCase()})`}
            isOptionEqualToValue={(option, val) => option.code === val.code}
            disabled={disabled}
            size={size}
            fullWidth={fullWidth}
            filterOptions={(options, { inputValue }) => {
                const search = inputValue.toLowerCase();
                return options.filter(
                    (o) =>
                        o.name.toLowerCase().includes(search) ||
                        o.native.toLowerCase().includes(search) ||
                        o.code.includes(search)
                );
            }}
            renderOption={(props, option) => {
                const { key, ...restProps } = props as any;
                return (
                    <Box
                        component="li"
                        key={key}
                        {...restProps}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}
                    >
                        <FlagImage code={option.code} size={24} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                                {option.name}
                            </Typography>
                            {option.native !== option.name && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {option.native}
                                </Typography>
                            )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {option.code.toUpperCase()}
                        </Typography>
                    </Box>
                );
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder={placeholder}
                    helperText={helperText}
                    error={error}
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: value && !Array.isArray(value) ? (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5, mr: 0.5 }}>
                                    <FlagImage code={value} size={22} />
                                </Box>
                                {params.InputProps.startAdornment}
                            </>
                        ) : params.InputProps.startAdornment,
                    }}
                />
            )}
        />
    );
};

export { CountryChip };
export default CountrySelect;
