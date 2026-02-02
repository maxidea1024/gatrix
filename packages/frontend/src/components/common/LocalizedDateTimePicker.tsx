import React, { useEffect } from "react";
import {
  DateTimePicker,
  DateTimePickerProps,
  LocalizationProvider,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useTranslation } from "react-i18next";
import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/ko";
import "dayjs/locale/en";
import "dayjs/locale/zh";
import { getDateLocale, parseUTCForPicker } from "@/utils/dateFormat";

dayjs.extend(utc);
dayjs.extend(timezone);

export interface LocalizedDateTimePickerProps {
  // Basic props
  label?: string;
  value: string | null; // UTC ISO string or null
  onChange: (isoString: string) => void; // Returns UTC ISO string or empty string

  // Optional props
  helperText?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  minDateTime?: Dayjs;
  maxDateTime?: Dayjs;

  // Styling
  sx?: any;
}

/**
 * Localized DateTimePicker component with built-in multi-language support.
 *
 * Features:
 * - Automatically displays weekdays and AM/PM in the current language (ko, en, zh)
 * - Accepts and returns UTC ISO strings
 * - Wrapped with LocalizationProvider
 *
 * Usage:
 * ```tsx
 * <LocalizedDateTimePicker
 *   label={t('maintenance.startDate')}
 *   value={startDate}
 *   onChange={setStartDate}
 *   helperText={t('maintenance.startDateHelp')}
 * />
 * ```
 */
const LocalizedDateTimePicker: React.FC<LocalizedDateTimePickerProps> = ({
  label,
  value,
  onChange,
  helperText,
  fullWidth = true,
  disabled = false,
  minDateTime,
  maxDateTime,
  sx,
}) => {
  const { i18n } = useTranslation();

  // Set dayjs locale based on current language
  useEffect(() => {
    const currentLang = i18n.language;
    if (currentLang === "ko") {
      dayjs.locale("ko");
    } else if (currentLang === "zh") {
      dayjs.locale("zh");
    } else {
      dayjs.locale("en");
    }
  }, [i18n.language]);

  const handleChange = (date: Dayjs | null) => {
    // DateTimePicker returns Dayjs in user's timezone, convert to UTC ISO string
    const isoString = date ? date.utc().toISOString() : "";
    onChange(isoString);
  };

  // Get the locale for LocalizationProvider
  const dateLocale = getDateLocale(i18n.language);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dateLocale}>
      <DateTimePicker
        label={label}
        value={parseUTCForPicker(value)}
        onChange={handleChange}
        disabled={disabled}
        minDateTime={minDateTime}
        maxDateTime={maxDateTime}
        ampm={true}
        format="YYYY-MM-DD A hh:mm"
        views={["year", "month", "day", "hours", "minutes"]}
        timeSteps={{ minutes: 1 }}
        slotProps={{
          textField: {
            fullWidth,
            helperText,
            slotProps: { input: { readOnly: true } },
            sx,
          },
          actionBar: {
            actions: ["clear", "cancel", "accept"],
          },
        }}
      />
    </LocalizationProvider>
  );
};

export default LocalizedDateTimePicker;
