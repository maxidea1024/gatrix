import React, { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Stack,
  IconButton,
  Paper,
  Select,
  Checkbox,
  ListItemText,
  Tooltip,
  SelectChangeEvent,
} from "@mui/material";
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Tune as TuneIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

export interface FilterDefinition {
  key: string;
  label: string;
  type: "text" | "select" | "multiselect" | "number" | "tags";
  options?: {
    value: any;
    label: string;
    color?: string;
    description?: string;
    icon?: React.ReactNode;
  }[];
  placeholder?: string;
  operator?: "any_of" | "include_all"; // For multiselect and tags - default is any_of
  allowOperatorToggle?: boolean; // If false, operator toggle is disabled (default: true for tags, false for multiselect)
}

export interface ActiveFilter {
  key: string;
  value: any;
  label: string;
  operator?: "any_of" | "include_all"; // For multiselect and tags
}

interface DynamicFilterBarProps {
  availableFilters: FilterDefinition[];
  activeFilters: ActiveFilter[];
  onFilterAdd: (filter: ActiveFilter) => void;
  onFilterRemove: (filterKey: string) => void;
  onFilterChange: (filterKey: string, value: any) => void;
  onOperatorChange?: (
    filterKey: string,
    operator: "any_of" | "include_all",
  ) => void;
  onRefresh?: () => void; // Optional refresh callback
  refreshDisabled?: boolean; // Optional refresh button disabled state
  leftActions?: React.ReactNode; // Optional left-aligned actions (before filters)
  afterFilterAddActions?: React.ReactNode; // Optional actions after filter add button
  noWrap?: boolean; // Optional: prevent wrapping to single line (default: false, allows wrapping)
}

const DynamicFilterBar: React.FC<DynamicFilterBarProps> = ({
  availableFilters,
  activeFilters,
  onFilterAdd,
  onFilterRemove,
  onFilterChange,
  onOperatorChange,
  onRefresh,
  refreshDisabled,
  leftActions,
  afterFilterAddActions,
  noWrap = false,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState<boolean>(false);
  const editContainerRef = React.useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState<string>("");
  const justAddedFilterRef = React.useRef<string | null>(null);
  const textInputRef = React.useRef<HTMLInputElement>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleAddFilter = (filterDef: FilterDefinition) => {
    const defaultValue =
      filterDef.type === "multiselect" || filterDef.type === "tags"
        ? []
        : undefined;
    const defaultOperator = filterDef.operator || "any_of";
    onFilterAdd({
      key: filterDef.key,
      value: defaultValue,
      label: filterDef.label,
      operator:
        filterDef.type === "multiselect" || filterDef.type === "tags"
          ? defaultOperator
          : undefined,
    });
    setEditingFilter(filterDef.key);
    // Only open select dropdown for select/multiselect/tags types
    if (
      filterDef.type === "select" ||
      filterDef.type === "multiselect" ||
      filterDef.type === "tags"
    ) {
      setSelectOpen(true);
    }
    justAddedFilterRef.current = filterDef.key;
    // Clear the flag after a short delay to allow user to interact
    setTimeout(() => {
      justAddedFilterRef.current = null;
    }, 500);
    handleCloseMenu();
  };

  const handleRemoveFilter = (filterKey: string) => {
    onFilterRemove(filterKey);
    if (editingFilter === filterKey) {
      setEditingFilter(null);
    }
  };

  const handleCloseEdit = (filterKey: string) => {
    // Don't close if filter was just added (give user time to type)
    if (justAddedFilterRef.current === filterKey) {
      return;
    }

    const filter = activeFilters.find((f) => f.key === filterKey);
    if (
      !filter ||
      filter.value === undefined ||
      filter.value === "" ||
      (Array.isArray(filter.value) && filter.value.length === 0)
    ) {
      handleRemoveFilter(filterKey);
    } else {
      setEditingFilter(null);
    }
  };

  const getFilterDefinition = (key: string): FilterDefinition | undefined => {
    return availableFilters.find((f) => f.key === key);
  };

  const handleToggleOperator = (filterKey: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chip click
    const filter = activeFilters.find((f) => f.key === filterKey);
    if (!filter) return;

    const newOperator = filter.operator === "any_of" ? "include_all" : "any_of";
    if (onOperatorChange) {
      onOperatorChange(filterKey, newOperator);
    }
  };

  // Focus text input when entering edit mode for text filters
  React.useEffect(() => {
    if (editingFilter) {
      const filter = activeFilters.find((f) => f.key === editingFilter);
      if (filter) {
        const filterDef = getFilterDefinition(editingFilter);
        if (filterDef?.type === "text" || filterDef?.type === "number") {
          // Use setTimeout to ensure the input is rendered before focusing
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 50);
        }
      }
    }
  }, [editingFilter, activeFilters]);

  // Handle ESC key to cancel editing
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editingFilter) return;

      if (event.key === "Escape") {
        console.log("[DynamicFilterBar] ESC pressed, canceling edit");

        // Close select if open
        if (selectOpen) {
          setSelectOpen(false);
        }

        // Check if filter has a value
        const filter = activeFilters.find((f) => f.key === editingFilter);
        if (filter) {
          const filterDef = getFilterDefinition(editingFilter);
          const isEmpty =
            filterDef?.type === "multiselect" || filterDef?.type === "tags"
              ? !Array.isArray(filter.value) || filter.value.length === 0
              : !filter.value || filter.value === "";

          if (isEmpty) {
            // Remove filter if empty
            handleRemoveFilter(editingFilter);
          }
        }

        // Exit edit mode
        setEditingFilter(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingFilter, activeFilters, selectOpen]);

  // Handle click outside to cancel editing
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!editingFilter) return;

      const target = event.target as Node;

      // Check if click is on MUI Menu/Popover (Select dropdown only)
      // Only check for Popover and Menu, NOT Paper (Paper is used everywhere)
      const isMenuClick = (target as Element).closest(
        ".MuiPopover-root, .MuiMenu-root",
      );
      if (isMenuClick) {
        return; // Don't close if clicking on dropdown menu
      }

      // Check if click is outside the edit container
      if (
        editContainerRef.current &&
        !editContainerRef.current.contains(target)
      ) {
        console.log(
          "[DynamicFilterBar] Click outside edit container, editingFilter:",
          editingFilter,
        );

        // Don't remove filter if it was just added (give user time to type)
        if (justAddedFilterRef.current === editingFilter) {
          return;
        }

        // If Select is open, close it and exit edit mode
        if (selectOpen) {
          console.log(
            "[DynamicFilterBar] Select is open, closing it and exiting edit mode",
          );
          setSelectOpen(false);

          // Check if filter has a value before exiting
          const filter = activeFilters.find((f) => f.key === editingFilter);
          if (filter) {
            const filterDef = getFilterDefinition(editingFilter);
            const isEmpty =
              filterDef?.type === "multiselect" || filterDef?.type === "tags"
                ? !Array.isArray(filter.value) || filter.value.length === 0
                : !filter.value || filter.value === "";

            if (isEmpty) {
              // Remove filter if empty
              handleRemoveFilter(editingFilter);
            }
          }

          // Exit edit mode immediately
          setEditingFilter(null);
          return;
        }

        // Check if filter has a value
        const filter = activeFilters.find((f) => f.key === editingFilter);
        console.log("[DynamicFilterBar] Current filter value:", filter);

        if (filter) {
          const filterDef = getFilterDefinition(editingFilter);
          const isEmpty =
            filterDef?.type === "multiselect" || filterDef?.type === "tags"
              ? !Array.isArray(filter.value) || filter.value.length === 0
              : !filter.value || filter.value === "";

          console.log("[DynamicFilterBar] Filter isEmpty:", isEmpty);

          if (isEmpty) {
            // Remove filter if empty
            console.log("[DynamicFilterBar] Removing empty filter");
            handleRemoveFilter(editingFilter);
          }
        }

        // Cancel editing
        console.log("[DynamicFilterBar] Exiting edit mode");
        setEditingFilter(null);
        setSelectOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editingFilter, activeFilters, selectOpen]);

  const renderFilterValue = (filter: ActiveFilter) => {
    const filterDef = getFilterDefinition(filter.key);
    if (!filterDef) return null;

    const isEditing = editingFilter === filter.key;

    if (!isEditing) {
      // Display mode - show as chip or tag chips
      // Don't show filter if value is empty/undefined
      if (
        filter.value === undefined ||
        filter.value === null ||
        filter.value === ""
      ) {
        return null;
      }

      // Tags type - show selected tags as chips wrapped in a container chip
      if (filterDef.type === "tags" && filterDef.options) {
        // Ensure value is an array
        const valueArray = Array.isArray(filter.value)
          ? filter.value
          : filter.value
            ? [filter.value]
            : [];
        if (valueArray.length === 0) return null;

        const selectedOptions = filterDef.options.filter((opt) =>
          valueArray.includes(opt.value),
        );

        const operator = filter.operator || filterDef.operator || "any_of";
        const isSingleSelection = selectedOptions.length === 1;
        const isMultipleSelection = selectedOptions.length > 1;
        const allowToggle = filterDef.allowOperatorToggle !== false; // Default to true if not specified

        // Determine operator text
        let operatorText = "";
        if (isSingleSelection) {
          operatorText = "is";
        } else if (isMultipleSelection) {
          operatorText =
            operator === "include_all" ? "include all of" : "is any of";
        }

        return (
          <Chip
            label={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  flexWrap: "wrap",
                  py: 0.25,
                }}
              >
                <Box
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "primary.main",
                  }}
                >
                  {filter.label}
                </Box>
                {operatorText && (
                  <Tooltip
                    title={
                      !allowToggle ? t("common.filter.operatorLocked") : ""
                    }
                    arrow
                  >
                    <Box
                      onClick={
                        isMultipleSelection && onOperatorChange && allowToggle
                          ? (e) => handleToggleOperator(filter.key, e)
                          : undefined
                      }
                      sx={{
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        color: allowToggle ? "text.secondary" : "text.disabled",
                        fontStyle: "italic",
                        cursor:
                          isMultipleSelection && onOperatorChange && allowToggle
                            ? "pointer"
                            : "not-allowed",
                        px: 0.25,
                        opacity: allowToggle ? 1 : 0.6,
                        "&:hover":
                          isMultipleSelection && onOperatorChange && allowToggle
                            ? {
                                color: "primary.main",
                                textDecoration: "underline",
                              }
                            : {},
                      }}
                    >
                      {operatorText}
                    </Box>
                  </Tooltip>
                )}
                {selectedOptions.map((option) => (
                  <Tooltip
                    key={option.value}
                    title={option.description || ""}
                    arrow
                  >
                    <Chip
                      label={option.label}
                      size="small"
                      sx={{
                        height: "20px",
                        bgcolor: option.color || "primary.main",
                        color: "#fff",
                        fontWeight: 500,
                        fontSize: "0.7rem",
                        "& .MuiChip-label": {
                          px: 0.75,
                        },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            }
            onClick={() => setEditingFilter(filter.key)}
            onDelete={() => handleRemoveFilter(filter.key)}
            sx={{
              height: "auto",
              minHeight: "32px",
              bgcolor: "rgba(25, 118, 210, 0.08)",
              border: "1.5px solid",
              borderColor: "primary.main",
              fontWeight: 500,
              transition: "all 0.2s",
              cursor: "pointer",
              "&:hover": {
                borderColor: "primary.dark",
                boxShadow: "0 2px 8px rgba(25, 118, 210, 0.25)",
                transform: "translateY(-1px)",
              },
              "& .MuiChip-label": {
                display: "block",
                whiteSpace: "normal",
                py: 0.5,
                color: "primary.main",
              },
              "& .MuiChip-deleteIcon": {
                color: "primary.main",
                "&:hover": {
                  color: "error.main",
                  bgcolor: "rgba(211, 47, 47, 0.1)",
                },
              },
            }}
          />
        );
      }

      // Multiselect type - show selected items as chips wrapped in a container chip
      if (filterDef.type === "multiselect" && filterDef.options) {
        // Ensure value is an array
        const valueArray = Array.isArray(filter.value)
          ? filter.value
          : filter.value
            ? [filter.value]
            : [];
        if (valueArray.length === 0) return null;

        const selectedOptions = filterDef.options.filter((opt) =>
          valueArray.includes(opt.value),
        );

        const operator = filter.operator || filterDef.operator || "any_of";
        const isSingleSelection = selectedOptions.length === 1;
        const isMultipleSelection = selectedOptions.length > 1;
        const allowToggle = filterDef.allowOperatorToggle !== false; // Default to true if not specified

        // Determine operator text
        let operatorText = "";
        if (isSingleSelection) {
          operatorText = "is";
        } else if (isMultipleSelection) {
          operatorText =
            operator === "include_all" ? "include all of" : "is any of";
        }

        return (
          <Chip
            label={
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  flexWrap: "wrap",
                  py: 0.25,
                }}
              >
                <Box
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "primary.main",
                  }}
                >
                  {filter.label}
                </Box>
                {operatorText && (
                  <Tooltip
                    title={
                      !allowToggle ? t("common.filter.operatorLocked") : ""
                    }
                    arrow
                  >
                    <Box
                      onClick={
                        isMultipleSelection && onOperatorChange && allowToggle
                          ? (e) => handleToggleOperator(filter.key, e)
                          : undefined
                      }
                      sx={{
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        color: allowToggle ? "text.secondary" : "text.disabled",
                        fontStyle: "italic",
                        cursor:
                          isMultipleSelection && onOperatorChange && allowToggle
                            ? "pointer"
                            : "not-allowed",
                        px: 0.25,
                        opacity: allowToggle ? 1 : 0.6,
                        "&:hover":
                          isMultipleSelection && onOperatorChange && allowToggle
                            ? {
                                color: "primary.main",
                                textDecoration: "underline",
                              }
                            : {},
                      }}
                    >
                      {operatorText}
                    </Box>
                  </Tooltip>
                )}
                {selectedOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    size="small"
                    sx={{
                      height: "20px",
                      bgcolor: "rgba(25, 118, 210, 0.08)",
                      color: "primary.main",
                      border: "1px solid",
                      borderColor: "primary.main",
                      fontWeight: 500,
                      fontSize: "0.7rem",
                      "& .MuiChip-label": {
                        px: 0.75,
                      },
                    }}
                  />
                ))}
              </Box>
            }
            onDelete={() => handleRemoveFilter(filter.key)}
            onClick={() => setEditingFilter(filter.key)}
            sx={{
              height: "auto",
              minHeight: "32px",
              bgcolor: "rgba(25, 118, 210, 0.04)",
              border: "1.5px solid",
              borderColor: "primary.main",
              cursor: "pointer",
              transition: "all 0.2s",
              "& .MuiChip-label": {
                display: "block",
                whiteSpace: "normal",
                px: 1,
                py: 0.5,
              },
              "& .MuiChip-deleteIcon": {
                fontSize: "18px",
                color: "text.secondary",
                "&:hover": {
                  color: "error.main",
                },
              },
              "&:hover": {
                borderColor: "primary.dark",
                boxShadow: "0 2px 8px rgba(25, 118, 210, 0.15)",
                transform: "translateY(-1px)",
              },
            }}
          />
        );
      }

      // Single select or text - show as single chip
      let displayValue = filter.value;
      if (filterDef.type === "select" && filterDef.options) {
        const option = filterDef.options.find(
          (opt) => opt.value == filter.value,
        ); // Use == for type coercion
        displayValue = option ? option.label : filter.value;
      }

      return (
        <Chip
          icon={<FilterListIcon />}
          label={
            <Box
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              <Box component="span">{filter.label}</Box>
              <Box
                component="span"
                sx={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: "text.secondary",
                }}
              >
                is
              </Box>
              <Box component="span">{displayValue}</Box>
            </Box>
          }
          onClick={() => setEditingFilter(filter.key)}
          onDelete={() => handleRemoveFilter(filter.key)}
          sx={{
            height: "32px",
            bgcolor: "rgba(25, 118, 210, 0.08)",
            color: "primary.main",
            border: "1.5px solid",
            borderColor: "primary.main",
            fontWeight: 600,
            transition: "all 0.2s",
            cursor: "pointer",
            "&:hover": {
              borderColor: "primary.dark",
              boxShadow: "0 2px 8px rgba(25, 118, 210, 0.25)",
              transform: "translateY(-1px)",
            },
            "& .MuiChip-icon": {
              color: "primary.main",
            },
            "& .MuiChip-deleteIcon": {
              color: "primary.main",
              "&:hover": {
                color: "error.main",
                bgcolor: "rgba(211, 47, 47, 0.1)",
              },
            },
          }}
        />
      );
    }

    // Edit mode - show input control with refined styling
    return (
      <Box
        ref={editContainerRef}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          px: 1.5,
          py: 0.75,
          gap: 1,
          minHeight: "32px",
          border: "1.5px solid",
          borderColor: "primary.main",
          borderRadius: 0,
          bgcolor: "rgba(25, 118, 210, 0.08)",
        }}
      >
        <Box
          sx={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "primary.main",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          {filter.label}
        </Box>

        {filterDef.type === "text" && (
          <TextField
            size="small"
            value={filter.value || ""}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            onBlur={() => {
              setTimeout(() => handleCloseEdit(filter.key), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCloseEdit(filter.key);
              } else if (e.key === "Escape") {
                handleRemoveFilter(filter.key);
              }
            }}
            placeholder={filterDef.placeholder}
            inputRef={textInputRef}
            autoFocus
            sx={{
              minWidth: 180,
              "& .MuiInputBase-root": {
                height: "28px",
                fontSize: "0.8125rem",
                bgcolor: "background.paper",
                borderRadius: 0,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(0, 0, 0, 0.12)",
              },
              "& .MuiInputBase-input": {
                py: 0.5,
              },
            }}
          />
        )}

        {filterDef.type === "number" && (
          <TextField
            size="small"
            type="number"
            value={filter.value || ""}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            onBlur={() => {
              setTimeout(() => handleCloseEdit(filter.key), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCloseEdit(filter.key);
              } else if (e.key === "Escape") {
                handleRemoveFilter(filter.key);
              }
            }}
            placeholder={filterDef.placeholder}
            inputRef={textInputRef}
            autoFocus
            sx={{
              minWidth: 120,
              "& .MuiInputBase-root": {
                height: "28px",
                fontSize: "0.8125rem",
                bgcolor: "background.paper",
                borderRadius: 0,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(0, 0, 0, 0.12)",
              },
              "& .MuiInputBase-input": {
                py: 0.5,
              },
            }}
          />
        )}

        {filterDef.type === "select" && filterDef.options && (
          <FormControl
            size="small"
            sx={{
              minWidth: 160,
            }}
          >
            <Select
              value={filter.value ?? ""}
              open={selectOpen && editingFilter === filter.key}
              onOpen={() => setSelectOpen(true)}
              onClose={() => {
                setSelectOpen(false);
                setEditingFilter(null);
              }}
              onChange={(e) => {
                const newValue =
                  e.target.value === "" ? undefined : e.target.value;
                onFilterChange(filter.key, newValue);
                // Close immediately after selection
                if (newValue !== undefined && newValue !== "") {
                  setSelectOpen(false);
                  setEditingFilter(null);
                } else {
                  // If cleared, remove filter
                  setSelectOpen(false);
                  handleRemoveFilter(filter.key);
                }
              }}
              autoFocus
              sx={{
                height: "28px",
                fontSize: "0.8125rem",
                bgcolor: "background.paper",
                borderRadius: 0,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(0, 0, 0, 0.12)",
                },
                "& .MuiSelect-select": {
                  py: 0.5,
                },
              }}
            >
              {filterDef.options.map((option, idx) => (
                <MenuItem
                  key={`${filter.key}-${idx}-${option.value}`}
                  value={option.value}
                >
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {filterDef.type === "multiselect" && filterDef.options && (
          <FormControl
            size="small"
            sx={{
              minWidth: 200,
            }}
          >
            <Select
              multiple
              value={filter.value || []}
              open={selectOpen && editingFilter === filter.key}
              onOpen={() => {
                setSelectOpen(true);
                setSearchText("");
              }}
              onClose={() => {
                setSelectOpen(false);
                setSearchText("");

                // Immediately exit editing mode when Select closes
                const currentFilter = activeFilters.find(
                  (f) => f.key === filter.key,
                );
                const hasValue =
                  currentFilter &&
                  Array.isArray(currentFilter.value) &&
                  currentFilter.value.length > 0;

                if (!hasValue) {
                  // Remove filter if no values selected
                  handleRemoveFilter(filter.key);
                }

                // Always exit editing mode when Select closes
                setEditingFilter(null);
              }}
              onChange={(e: SelectChangeEvent<any>) => {
                onFilterChange(filter.key, e.target.value);
              }}
              autoFocus
              renderValue={(selected) => {
                if (!Array.isArray(selected) || selected.length === 0)
                  return "";
                const selectedOptions = filterDef.options!.filter((opt) =>
                  selected.includes(opt.value),
                );
                return (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selectedOptions.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        size="small"
                        sx={{
                          height: "20px",
                          fontSize: "0.7rem",
                          bgcolor: "primary.lighter",
                          color: "primary.main",
                          "& .MuiChip-label": {
                            px: 0.75,
                          },
                        }}
                      />
                    ))}
                  </Box>
                );
              }}
              sx={{
                minHeight: "28px",
                fontSize: "0.8125rem",
                bgcolor: "background.paper",
                borderRadius: 0,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(0, 0, 0, 0.12)",
                },
                "& .MuiSelect-select": {
                  py: 0.5,
                },
              }}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 400,
                  },
                },
              }}
            >
              {/* Search box at the top */}
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  position: "sticky",
                  top: 0,
                  bgcolor: "background.paper",
                  zIndex: 1,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <TextField
                  size="small"
                  placeholder={t("common.search")}
                  value={searchText}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSearchText(e.target.value);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  fullWidth
                  sx={{
                    "& .MuiInputBase-root": {
                      height: "32px",
                      fontSize: "0.875rem",
                    },
                  }}
                />
              </Box>

              {filterDef.options
                .filter(
                  (option) =>
                    !searchText ||
                    option.label
                      .toLowerCase()
                      .includes(searchText.toLowerCase()),
                )
                .map((option, idx) => (
                  <MenuItem
                    key={`${filter.key}-ms-${idx}-${option.value}`}
                    value={option.value}
                  >
                    <Checkbox
                      checked={
                        Array.isArray(filter.value) &&
                        filter.value.indexOf(option.value) > -1
                      }
                      size="small"
                    />
                    {option.icon && (
                      <Box
                        sx={{ display: "flex", alignItems: "center", mr: 1 }}
                      >
                        {option.icon}
                      </Box>
                    )}
                    <ListItemText primary={option.label} />
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        )}

        {filterDef.type === "tags" && filterDef.options && (
          <FormControl
            size="small"
            sx={{
              minWidth: 200,
            }}
          >
            <Select
              multiple
              value={filter.value || []}
              open={selectOpen && editingFilter === filter.key}
              onOpen={() => {
                setSelectOpen(true);
                setSearchText("");
              }}
              onClose={() => {
                setSelectOpen(false);
                setSearchText("");

                // Immediately exit editing mode when Select closes
                const currentFilter = activeFilters.find(
                  (f) => f.key === filter.key,
                );
                const hasValue =
                  currentFilter &&
                  Array.isArray(currentFilter.value) &&
                  currentFilter.value.length > 0;

                if (!hasValue) {
                  // Remove filter if no values selected
                  handleRemoveFilter(filter.key);
                }

                // Always exit editing mode when Select closes
                setEditingFilter(null);
              }}
              onChange={(e: SelectChangeEvent<any>) => {
                onFilterChange(filter.key, e.target.value);
              }}
              autoFocus
              renderValue={(selected) => {
                if (!Array.isArray(selected) || selected.length === 0)
                  return "";
                const selectedOptions = filterDef.options!.filter((opt) =>
                  selected.includes(opt.value),
                );
                return (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {selectedOptions.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        size="small"
                        sx={{
                          height: "20px",
                          bgcolor: option.color || "primary.main",
                          color: "#fff",
                          fontSize: "0.7rem",
                          "& .MuiChip-label": {
                            px: 1,
                          },
                        }}
                      />
                    ))}
                  </Box>
                );
              }}
              sx={{
                minHeight: "28px",
                fontSize: "0.8125rem",
                bgcolor: "background.paper",
                borderRadius: 0,
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(0, 0, 0, 0.12)",
                },
                "& .MuiSelect-select": {
                  py: 0.5,
                },
              }}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 400,
                  },
                },
              }}
            >
              {/* Search box at the top */}
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  position: "sticky",
                  top: 0,
                  bgcolor: "background.paper",
                  zIndex: 1,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <TextField
                  size="small"
                  placeholder={t("common.search")}
                  value={searchText}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSearchText(e.target.value);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  fullWidth
                  sx={{
                    "& .MuiInputBase-root": {
                      height: "32px",
                      fontSize: "0.875rem",
                    },
                  }}
                />
              </Box>

              {filterDef.options
                .filter(
                  (option) =>
                    !searchText ||
                    option.label
                      .toLowerCase()
                      .includes(searchText.toLowerCase()) ||
                    (option.description &&
                      option.description
                        .toLowerCase()
                        .includes(searchText.toLowerCase())),
                )
                .map((option, idx) => (
                  <MenuItem
                    key={`${filter.key}-tag-${idx}-${option.value}`}
                    value={option.value}
                  >
                    <Checkbox
                      checked={
                        Array.isArray(filter.value) &&
                        filter.value.indexOf(option.value) > -1
                      }
                      size="small"
                    />
                    <Tooltip
                      title={option.description || ""}
                      arrow
                      placement="right"
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          flex: 1,
                        }}
                      >
                        <Chip
                          label={option.label}
                          size="small"
                          sx={{
                            height: "22px",
                            bgcolor: option.color || "primary.main",
                            color: "#fff",
                            fontSize: "0.75rem",
                          }}
                        />
                        {option.description && (
                          <Box
                            component="span"
                            sx={{
                              fontSize: "0.75rem",
                              color: "text.secondary",
                            }}
                          >
                            {option.description}
                          </Box>
                        )}
                      </Box>
                    </Tooltip>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        )}

        <IconButton
          size="small"
          onClick={() => handleRemoveFilter(filter.key)}
          sx={{
            width: 20,
            height: 20,
            p: 0,
            color: "primary.main",
            "&:hover": {
              color: "error.main",
              bgcolor: "transparent",
            },
          }}
        >
          ✕
        </IconButton>
      </Box>
    );
  };

  // Helper function to check if a filter has a meaningful value
  const hasFilterValue = (filter: ActiveFilter): boolean => {
    if (
      filter.value === undefined ||
      filter.value === null ||
      filter.value === ""
    ) {
      return false;
    }
    if (Array.isArray(filter.value) && filter.value.length === 0) {
      return false;
    }
    return true;
  };

  // Get filters that are not yet active (only exclude filters with actual values)
  // This fixes the bug where cancelled/empty filters disappear from the menu
  const availableToAdd = availableFilters.filter(
    (f) => !activeFilters.some((af) => af.key === f.key && hasFilterValue(af)),
  );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        width: noWrap ? "100%" : "auto",
        flexWrap: noWrap ? "nowrap" : "wrap",
      }}
    >
      {/* Left Actions - Before filters */}
      {leftActions && <Box sx={{ flexShrink: 0 }}>{leftActions}</Box>}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flex: noWrap ? 1 : "auto",
          minWidth: noWrap ? 0 : "auto",
          overflow: noWrap ? "auto" : "visible",
          flexWrap: noWrap ? "nowrap" : "wrap",
        }}
      >
        {activeFilters.map((filter) => (
          <React.Fragment key={`filter-wrapper-${filter.key}`}>
            {renderFilterValue(filter)}
          </React.Fragment>
        ))}

        {availableToAdd.length > 0 && (
          <>
            <Button
              startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
              onClick={handleOpenMenu}
              variant="text"
              size="small"
              sx={{
                height: "32px",
                minWidth: "auto",
                px: 1.5,
                py: 0.5,
                textTransform: "none",
                color: "text.secondary",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                "&:hover": {
                  bgcolor: "action.hover",
                  color: "primary.main",
                },
              }}
            >
              {t("common.filters.title")}
            </Button>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleCloseMenu}
              PaperProps={{
                sx: {
                  mt: 0.5,
                  minWidth: 180,
                  boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
                },
              }}
            >
              {availableToAdd.map((filterDef) => (
                <MenuItem
                  key={`add-filter-${filterDef.key}`}
                  onClick={() => handleAddFilter(filterDef)}
                  sx={{
                    fontSize: "0.875rem",
                    py: 1,
                    "&:hover": {
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  {filterDef.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {/* Actions after filter add button */}
        {afterFilterAddActions && (
          <Box sx={{ flexShrink: 0 }}>{afterFilterAddActions}</Box>
        )}
      </Box>

      {/* Refresh Button - Right aligned */}
      {onRefresh && (
        <Box sx={{ flexShrink: 0 }}>
          <Tooltip title={refreshDisabled ? "" : t("common.refresh")}>
            <span>
              <IconButton
                size="small"
                onClick={onRefresh}
                disabled={refreshDisabled}
              >
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default DynamicFilterBar;
