import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  FormControl,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormLabel,
  Grid,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Edit as EditIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

import moment from 'moment';
import 'moment/locale/ko';

// FullCalendar imports
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import enLocale from '@fullcalendar/core/locales/en-gb';
import zhLocale from '@fullcalendar/core/locales/zh-cn';

import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import FormDialogHeader from '@/components/common/FormDialogHeader';

// ?§Ï?Ï§??¥Î≤§???Ä???ïÏùò
interface ScheduleEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  description?: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

// Job Î∞?Trigger ?Ä???ïÏùò (Quartzmin ?§Ì???
interface JobDetail {
  id: string;
  name: string;
  group: string;
  description?: string;
  jobClass: string;
  dataMap: Record<string, any>;
  status: 'active' | 'paused' | 'error';
  lastExecution?: Date;
  nextExecution?: Date;
}

interface TriggerDetail {
  id: string;
  name: string;
  group: string;
  jobName: string;
  jobGroup: string;
  type: 'cron' | 'simple' | 'calendar' | 'daily';
  cronExpression?: string;
  repeatInterval?: number;
  repeatCount?: number;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'complete' | 'error';
  nextFireTime?: Date;
  previousFireTime?: Date;
}

interface JobExecution {
  id: string;
  jobName: string;
  jobGroup: string;
  triggerName: string;
  triggerGroup: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'success' | 'error';
  errorMessage?: string;
}

interface CreateScheduleEventData {
  title: string;
  start: Date;
  end?: Date;
  description?: string;
  allDay?: boolean;
  scheduleType: 'once' | 'cron' | 'interval';
  cronExpression: string;
  intervalMinutes: number;
  repeatCount: number; // -1?Ä Î¨¥Ìïú Î∞òÎ≥µ
  calendar?: string;
  misfireInstruction?: string;
  priority?: number;
  timeZone?: string;
  repeatForever?: boolean;
  startTimeOfDay?: string;
  endTimeOfDay?: string;
  daysOfWeek?: string[];
  jobDataMap?: { [key: string]: { value: string; type: string } };
}

const SchedulerPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const calendarRef = useRef<FullCalendar>(null);
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.SCHEDULER_MANAGE]);

  // State
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState<CreateScheduleEventData>({
    title: '',
    start: new Date(),
    end: undefined,
    description: '',
    allDay: false,
    scheduleType: 'interval',
    cronExpression: '0 0 12 * * ?', // Îß§Ïùº ?ïÏò§
    intervalMinutes: 1,
    repeatCount: -1,
    calendar: '--- Not Set ---',
    misfireInstruction: 'Smart Policy',
    priority: 5,
    timeZone: 'Asia/Seoul',
    repeatForever: true,
    startTimeOfDay: '00:00:00',
    endTimeOfDay: '23:59:59',
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    jobDataMap: {},
  });

  // ?§Ï?Ï§??¥Î≤§??Î°úÎî© (?§Ï†úÎ°úÎäî API?êÏÑú Í∞Ä?∏Ïò¥)
  const loadEvents = async () => {
    setLoading(true);
    try {
      // ?ÑÏãú ?∞Ïù¥??      const mockEvents: ScheduleEvent[] = [
        {
          id: '1',
          title: '?Ä ÎØ∏ÌåÖ',
          start: '2024-01-15T10:00:00',
          end: '2024-01-15T11:00:00',
          description: 'Ï£ºÍ∞Ñ ?Ä ÎØ∏ÌåÖ',
          backgroundColor: '#1976d2',
          borderColor: '#1976d2',
        },
        {
          id: '2',
          title: '?ÑÎ°ú?ùÌä∏ Î¶¨Î∑∞',
          start: '2024-01-16T14:00:00',
          end: '2024-01-16T16:00:00',
          description: 'Î∂ÑÍ∏∞Î≥??ÑÎ°ú?ùÌä∏ Î¶¨Î∑∞',
          backgroundColor: '#388e3c',
          borderColor: '#388e3c',
        },
        {
          id: '3',
          title: '?úÏä§???êÍ?',
          start: '2024-01-17',
          allDay: true,
          description: '?ïÍ∏∞ ?úÏä§???êÍ?',
          backgroundColor: '#f57c00',
          borderColor: '#f57c00',
        },
      ];
      setEvents(mockEvents);
    } catch (error) {
      console.error('Failed to load schedule events:', error);
      enqueueSnackbar(t('scheduler.errors.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Ï∫òÎ¶∞???¥Î≤§???∏Îì§??  const handleDateSelect = (selectInfo: any) => {
    setSelectedDate(selectInfo.start);
    setEditingEvent(null);
    setFormData({
      title: '',
      start: selectInfo.start,
      end: selectInfo.end,
      description: '',
      allDay: selectInfo.allDay,
    });
    setDialogOpen(true);
  };

  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    setEditingEvent({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end ? event.end.toISOString() : undefined,
      description: event.extendedProps.description || '',
      allDay: event.allDay,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
    });
    setFormData({
      title: event.title,
      start: event.start,
      end: event.end,
      description: event.extendedProps.description || '',
      allDay: event.allDay,
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingEvent(null);
    setSelectedDate(new Date());
    setFormData({
      title: '',
      start: new Date(),
      end: undefined,
      description: '',
      allDay: false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      enqueueSnackbar(t('scheduler.titleRequired'), { variant: 'error' });
      return;
    }

    if (!formData.start) {
      enqueueSnackbar(t('scheduler.startTimeRequired'), { variant: 'error' });
      return;
    }

    // Ï¢ÖÎ£å ?úÍ∞Ñ???úÏûë ?úÍ∞ÑÎ≥¥Îã§ ?¥Ï†Ñ?∏Ï? ?ïÏù∏
    if (formData.end && formData.end <= formData.start) {
      enqueueSnackbar(t('scheduler.endTimeAfterStart'), { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      // ?ÑÏãú Íµ¨ÌòÑ (?§Ï†úÎ°úÎäî API ?∏Ï∂ú)
      if (editingEvent) {
        enqueueSnackbar(t('scheduler.eventUpdated'), { variant: 'success' });
      } else {
        enqueueSnackbar(t('scheduler.eventCreated'), { variant: 'success' });
      }

      setDialogOpen(false);
      await loadEvents();
    } catch (error) {
      console.error('Failed to save schedule event:', error);
      enqueueSnackbar(t('scheduler.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;

    if (!confirm(t('scheduler.confirmDelete', { name: editingEvent.title }))) {
      return;
    }

    try {
      // ?ÑÏãú Íµ¨ÌòÑ (?§Ï†úÎ°úÎäî API ?∏Ï∂ú)
      enqueueSnackbar(t('scheduler.eventDeleted'), { variant: 'success' });
      setDialogOpen(false);
      await loadEvents();
    } catch (error) {
      console.error('Failed to delete schedule event:', error);
      enqueueSnackbar(t('scheduler.errors.deleteFailed'), { variant: 'error' });
    }
  };

  // ?ÑÏû¨ ?∏Ïñ¥???∞Î•∏ Î°úÏ????§Ï†ï
  const currentLanguage = i18n.language;
  moment.locale(currentLanguage);

  // FullCalendar Î°úÏ????†ÌÉù
  const getCalendarLocale = () => {
    switch (currentLanguage) {
      case 'en':
        return enLocale;
      case 'zh':
        return zhLocale;
      case 'ko':
      default:
        return koLocale;
    }
  };

  // FullCalendar Î≤ÑÌäº ?çÏä§???†ÌÉù
  const getButtonText = () => {
    switch (currentLanguage) {
      case 'en':
        return {
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
          dayGridMonth: 'Month',
          timeGridWeek: 'Week',
          timeGridDay: 'Day'
        };
      case 'zh':
        return {
          today: '‰ªäÂ§©',
          month: '??,
          week: '??,
          day: '??,
          dayGridMonth: '??,
          timeGridWeek: '??,
          timeGridDay: '??
        };
      case 'ko':
      default:
        return {
          today: '?§Îäò',
          month: '??,
          week: 'Ï£?,
          day: '??,
          dayGridMonth: '??,
          timeGridWeek: 'Ï£?,
          timeGridDay: '??
        };
    }
  };

  return (
    <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ScheduleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('scheduler.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('scheduler.subtitle')}
              </Typography>
            </Box>
          </Box>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              {t('scheduler.addEvent')}
            </Button>
          )}
        </Box>

        {/* Calendar */}
        <Card>
          <CardContent>
            {loading && <LinearProgress sx={{ mb: 2 }} />}
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              initialView="dayGridMonth"
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              events={events}
              select={handleDateSelect}
              eventClick={handleEventClick}
              height="auto"
              locale={getCalendarLocale()}
              buttonText={getButtonText()}
              eventDisplay="block"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }}
              nowIndicator={true}
              scrollTime="09:00:00"
            />
          </CardContent>
        </Card>

        {/* Add/Edit Event Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <FormDialogHeader
            title={editingEvent ? '?§Ï?Ï§??¥Î≤§???∏Ïßë' : '?§Ï?Ï§??¥Î≤§??Ï∂îÍ?'}
            description={editingEvent
              ? 'Í∏∞Ï°¥ ?§Ï?Ï§??¥Î≤§?∏Ïùò ?ïÎ≥¥Î•??òÏ†ï?òÍ≥† ?ÖÎç∞?¥Ìä∏?????àÏäµ?àÎã§.'
              : '?àÎ°ú???§Ï?Ï§??¥Î≤§?∏Î? ?ùÏÑ±?òÍ≥† ?§Ìñâ ?úÍ∞Ñ???§Ï†ï?????àÏäµ?àÎã§.'
            }
          />
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
              {/* Í∏∞Î≥∏ ?ïÎ≥¥ */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <DateTimePicker
                    label="Start Date/Time"
                    value={formData.start ? moment(formData.start) : null}
                    onChange={(date) => setFormData({ ...formData, start: date ? date.toDate() : new Date() })}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{ textField: { fullWidth: true, slotProps: { input: { readOnly: true } } } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <DateTimePicker
                    label="End Date/Time"
                    value={formData.end ? moment(formData.end) : null}
                    onChange={(date) => setFormData({ ...formData, end: date ? date.toDate() : undefined })}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{ textField: { fullWidth: true, slotProps: { input: { readOnly: true } } } }}
                  />
                </Grid>
              </Grid>

              {/* Calendar */}
              <FormControl fullWidth>
                <InputLabel>Calendar</InputLabel>
                <Select
                  value={formData.calendar || '--- Not Set ---'}
                  label="Calendar"
                  onChange={(e) => setFormData({ ...formData, calendar: e.target.value })}
                >
                  <MenuItem value="--- Not Set ---">--- Not Set ---</MenuItem>
                  <MenuItem value="BusinessCalendar">Business Calendar</MenuItem>
                  <MenuItem value="HolidayCalendar">Holiday Calendar</MenuItem>
                </Select>
              </FormControl>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Misfire Instruction</InputLabel>
                    <Select
                      value={formData.misfireInstruction || 'Smart Policy'}
                      label="Misfire Instruction"
                      onChange={(e) => setFormData({ ...formData, misfireInstruction: e.target.value })}
                    >
                      <MenuItem value="Smart Policy">Smart Policy</MenuItem>
                      <MenuItem value="Ignore Misfire Policy">Ignore Misfire Policy</MenuItem>
                      <MenuItem value="Do Nothing">Do Nothing</MenuItem>
                      <MenuItem value="Fire Now">Fire Now</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={formData.priority || 5}
                      label="Priority"
                      onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <MenuItem key={num} value={num}>{num}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Daily Time Interval Trigger Properties */}
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Daily Time Interval Trigger Properties
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField
                    fullWidth
                    label="Repeat Interval"
                    type="number"
                    value={formData.intervalMinutes}
                    onChange={(e) => setFormData({ ...formData, intervalMinutes: Number(e.target.value) })}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Unit</InputLabel>
                    <Select
                      value="Minute"
                      label="Unit"
                    >
                      <MenuItem value="Second">Second</MenuItem>
                      <MenuItem value="Minute">Minute</MenuItem>
                      <MenuItem value="Hour">Hour</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <FormControl fullWidth>
                    <InputLabel>Time Zone</InputLabel>
                    <Select
                      value={formData.timeZone || 'Asia/Seoul'}
                      label="Time Zone"
                      onChange={(e) => setFormData({ ...formData, timeZone: e.target.value })}
                    >
                      <MenuItem value="Asia/Seoul">(GMT+09:00) Asia/Seoul</MenuItem>
                      <MenuItem value="UTC">(GMT+00:00) UTC</MenuItem>
                      <MenuItem value="America/New_York">(GMT-05:00) America/New_York</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Repeat Count"
                    type="number"
                    value={formData.repeatCount === -1 ? '' : formData.repeatCount}
                    onChange={(e) => setFormData({ ...formData, repeatCount: e.target.value ? Number(e.target.value) : -1 })}
                    placeholder="Leave empty for infinite"
                  />
                </Grid>
                <Grid size={{ xs: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControl>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="body2">Repeat Forever</Typography>
                      <input
                        type="checkbox"
                        checked={formData.repeatForever}
                        onChange={(e) => setFormData({
                          ...formData,
                          repeatForever: e.target.checked,
                          repeatCount: e.target.checked ? -1 : 1
                        })}
                      />
                    </Stack>
                  </FormControl>
                </Grid>
              </Grid>

              {/* ?úÍ∞Ñ Î≤îÏúÑ ?§Ï†ï */}
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="Start Time of Day"
                    type="time"
                    value={formData.startTimeOfDay || '00:00:00'}
                    onChange={(e) => setFormData({ ...formData, startTimeOfDay: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    fullWidth
                    label="End Time of Day"
                    type="time"
                    value={formData.endTimeOfDay || '23:59:59'}
                    onChange={(e) => setFormData({ ...formData, endTimeOfDay: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>

              {/* ?îÏùº ?†ÌÉù */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Days of Week</Typography>
                <Grid container spacing={1}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                    <Grid key={day}>
                      <FormControl>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <input
                            type="checkbox"
                            checked={formData.daysOfWeek?.includes(day) || false}
                            onChange={(e) => {
                              const days = formData.daysOfWeek || [];
                              if (e.target.checked) {
                                setFormData({ ...formData, daysOfWeek: [...days, day] });
                              } else {
                                setFormData({ ...formData, daysOfWeek: days.filter(d => d !== day) });
                              }
                            }}
                          />
                          <Typography variant="body2">{day}</Typography>
                        </Stack>
                      </FormControl>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Job Data Map */}
              <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                Job Data Map
              </Typography>

              <Box sx={{ border: '1px solid #ddd', borderRadius: 1, p: 2 }}>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="body2" fontWeight="bold">Name</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="body2" fontWeight="bold">Value</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="body2" fontWeight="bold">Type</Typography>
                  </Grid>
                </Grid>

                {/* Í∏∞Î≥∏ Count ?åÎùºÎØ∏ÌÑ∞ */}
                <Grid container spacing={2} sx={{ mb: 1 }}>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value="Count"
                      disabled
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      value="10"
                      onChange={(e) => {
                        const newJobDataMap = { ...formData.jobDataMap };
                        newJobDataMap['Count'] = { value: e.target.value, type: 'Integer' };
                        setFormData({ ...formData, jobDataMap: newJobDataMap });
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <FormControl fullWidth size="small">
                      <Select value="Integer">
                        <MenuItem value="String">String</MenuItem>
                        <MenuItem value="Integer">Integer</MenuItem>
                        <MenuItem value="Boolean">Boolean</MenuItem>
                        <MenuItem value="Float">Float</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {/* Ï∂îÍ? ?åÎùºÎØ∏ÌÑ∞ */}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Parameter Name"
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="String"
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <FormControl fullWidth size="small">
                      <Select value="String">
                        <MenuItem value="String">String</MenuItem>
                        <MenuItem value="Integer">Integer</MenuItem>
                        <MenuItem value="Boolean">Boolean</MenuItem>
                        <MenuItem value="Float">Float</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
              {editingEvent && (
                <Button
                  onClick={handleDelete}
                  disabled={saving}
                  color="error"
                  startIcon={<DeleteIcon />}
                >
                  {t('common.delete')}
                </Button>
              )}

              <Box sx={{ flexGrow: 1 }} />

              <Button onClick={() => setDialogOpen(false)} disabled={saving} startIcon={<CancelIcon />}>
                {t('common.cancel')}
              </Button>

              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? undefined : <SaveIcon />}
              >
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </Stack>
          </DialogActions>
        </Dialog>
      </Box>
  );
};

export default SchedulerPage;
