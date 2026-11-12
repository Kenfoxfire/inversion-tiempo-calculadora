import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type ActivityKind = 'custom' | 'work' | 'lunch';
type BuiltInActivityKind = Exclude<ActivityKind, 'custom'>;
type DurationField = 'hours' | 'minutes';
type ChartMode = 'day' | 'week';

interface Weekday {
  id: DayId;
  short: string;
  name: string;
}

interface Activity {
  id: string;
  kind: ActivityKind;
  name: string;
  color: string;
  enabled: boolean;
  distraction: boolean;
  minutesByDay: Record<DayId, number>;
}

interface ChartEntry {
  id: string;
  name: string;
  color: string;
  minutes: number;
  percent: number;
}

const WEEKDAYS: Weekday[] = [
  { id: 'mon', short: 'L', name: 'Lunes' },
  { id: 'tue', short: 'M', name: 'Martes' },
  { id: 'wed', short: 'X', name: 'Miércoles' },
  { id: 'thu', short: 'J', name: 'Jueves' },
  { id: 'fri', short: 'V', name: 'Viernes' },
  { id: 'sat', short: 'S', name: 'Sábado' },
  { id: 'sun', short: 'D', name: 'Domingo' },
];

const ACTIVITY_COLORS = ['#a8ce83', '#e4b976', '#9d9ae0', '#70bdba', '#e18a7e', '#79a7dd', '#d98db8'];
const ZERO_MINUTES: Record<DayId, number> = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};
const STORAGE_KEY = 'ritmo-time-data';
const DAY_IDS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface RestoredState {
  activities: Activity[];
  nextActivityId: number;
  message: string;
}

function nextCustomActivityId(activities: Activity[]): number {
  return activities.reduce((nextId, activity) => {
    const match = /^activity-(\d+)$/.exec(activity.id);
    return match ? Math.max(nextId, Number(match[1]) + 1) : nextId;
  }, 1);
}

function isActivityList(value: unknown): value is Activity[] {
  if (!Array.isArray(value)) {
    return false;
  }

  const ids = new Set<string>();
  const builtInKinds = new Set<ActivityKind>();
  return value.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const activity = item as Record<string, unknown>;
    if (
      typeof activity['id'] !== 'string' ||
      !activity['id'] ||
      ids.has(activity['id']) ||
      !['custom', 'work', 'lunch'].includes(String(activity['kind'])) ||
      typeof activity['name'] !== 'string' ||
      activity['name'].length > 30 ||
      typeof activity['color'] !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(activity['color']) ||
      typeof activity['enabled'] !== 'boolean' ||
      typeof activity['distraction'] !== 'boolean' ||
      typeof activity['minutesByDay'] !== 'object' ||
      activity['minutesByDay'] === null
    ) {
      return false;
    }

    const kind = activity['kind'] as ActivityKind;
    if (kind !== 'custom' && builtInKinds.has(kind)) {
      return false;
    }
    if (kind !== 'custom') {
      builtInKinds.add(kind);
    }

    const minutes = activity['minutesByDay'] as Record<string, unknown>;
    if (!DAY_IDS.every((day) => Number.isInteger(minutes[day]) && Number(minutes[day]) >= 0 && Number(minutes[day]) <= 1440)) {
      return false;
    }

    ids.add(activity['id'] as string);
    return true;
  });
}

function loadSavedState(): RestoredState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { activities: createExampleActivities(), nextActivityId: 1, message: 'Guardado automático activado' };
    }

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || !('activities' in parsed) || !isActivityList(parsed.activities)) {
      return { activities: createExampleActivities(), nextActivityId: 1, message: 'No se pudo leer el guardado; se cargó el ejemplo' };
    }

    return {
      activities: parsed.activities,
      nextActivityId: nextCustomActivityId(parsed.activities),
      message: 'Datos recuperados de este navegador',
    };
  } catch {
    return { activities: createExampleActivities(), nextActivityId: 1, message: 'No se pudo acceder al almacenamiento del navegador' };
  }
}

function createExampleActivities(): Activity[] {
  return [
    {
      id: 'study',
      kind: 'custom',
      name: 'Estudio',
      color: ACTIVITY_COLORS[0],
      enabled: true,
      distraction: false,
      minutesByDay: { mon: 60, tue: 120, wed: 60, thu: 120, fri: 60, sat: 120, sun: 0 },
    },
  ];
}

@Component({
  imports: [DecimalPipe, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  readonly weekdays = WEEKDAYS;
  private readonly restoredState = loadSavedState();
  readonly activities = signal<Activity[]>(this.restoredState.activities);
  readonly storageStatus = signal(this.restoredState.message);
  readonly activeActivities = computed(() => this.activities().filter((activity) => activity.enabled));
  readonly chartMode = signal<ChartMode>('day');
  readonly selectedChartDay = signal<DayId>('mon');
  readonly includeUnassigned = signal(true);
  readonly weeklyMinutes = computed(() =>
    this.activeActivities().reduce(
      (total, activity) =>
        total + WEEKDAYS.reduce((activityTotal, day) => activityTotal + activity.minutesByDay[day.id], 0),
      0,
    ),
  );
  readonly monthlyMinutes = computed(() => (this.weeklyMinutes() * 52) / 12);
  readonly yearlyMinutes = computed(() => this.weeklyMinutes() * 52);
  readonly weeklyDistractionMinutes = computed(() =>
    this.activeActivities()
      .filter((activity) => activity.distraction)
      .reduce(
        (total, activity) =>
          total + WEEKDAYS.reduce((activityTotal, day) => activityTotal + activity.minutesByDay[day.id], 0),
        0,
      ),
  );
  readonly yearlyDistractionMinutes = computed(() => this.weeklyDistractionMinutes() * 52);
  readonly distractionDayEquivalent = computed(() => this.yearlyDistractionMinutes() / (24 * 60));
  readonly activeDayCount = computed(
    () => WEEKDAYS.filter((day) => this.dayTotalMinutes(day.id) > 0).length,
  );
  readonly chartEntries = computed(() => {
    const categories = this.activeActivities().map((activity) => ({
      id: activity.id,
      name: this.activityName(activity),
      color: activity.color,
      minutes:
        this.chartMode() === 'day'
          ? activity.minutesByDay[this.selectedChartDay()]
          : WEEKDAYS.reduce((total, day) => total + activity.minutesByDay[day.id], 0),
    }));
    const trackedMinutes = categories.reduce((total, category) => total + category.minutes, 0);
    const periodMinutes = this.chartMode() === 'day' ? 24 * 60 : 7 * 24 * 60;
    const chartTotal = this.includeUnassigned()
      ? Math.max(periodMinutes, trackedMinutes)
      : trackedMinutes;
    const entries = categories.filter((category) => category.minutes > 0);
    const unassignedMinutes = Math.max(0, periodMinutes - trackedMinutes);

    if (this.includeUnassigned() && unassignedMinutes > 0) {
      entries.push({
        id: 'unassigned',
        name: 'Sin asignar',
        color: '#39413a',
        minutes: unassignedMinutes,
      });
    }

    return entries.map((entry) => ({
      ...entry,
      percent: chartTotal > 0 ? (entry.minutes / chartTotal) * 100 : 0,
    }));
  });
  readonly chartTotalMinutes = computed(() => {
    const trackedMinutes = this.chartMode() === 'day'
      ? this.dayTotalMinutes(this.selectedChartDay())
      : this.weeklyMinutes();
    const periodMinutes = this.chartMode() === 'day' ? 24 * 60 : 7 * 24 * 60;
    return this.includeUnassigned() ? Math.max(periodMinutes, trackedMinutes) : trackedMinutes;
  });
  readonly isChartPeriodOverbooked = computed(() => {
    const periodMinutes = this.chartMode() === 'day' ? 24 * 60 : 7 * 24 * 60;
    return this.chartTotalMinutes() > periodMinutes;
  });
  readonly distractionChartEntries = computed<ChartEntry[]>(() => {
    const entries = this.activeActivities()
      .filter((activity) => activity.distraction)
      .map((activity) => ({
        id: activity.id,
        name: this.activityName(activity),
        color: activity.color,
        minutes:
          this.chartMode() === 'day'
            ? activity.minutesByDay[this.selectedChartDay()]
            : WEEKDAYS.reduce((total, day) => total + activity.minutesByDay[day.id], 0),
        percent: 0,
      }))
      .filter((entry) => entry.minutes > 0);
    const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    return entries.map((entry) => ({ ...entry, percent: total > 0 ? (entry.minutes / total) * 100 : 0 }));
  });
  readonly distractionChartTotalMinutes = computed(() =>
    this.distractionChartEntries().reduce((total, entry) => total + entry.minutes, 0),
  );

  private nextActivityId = this.restoredState.nextActivityId;

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, activities: this.activities() }));
        this.storageStatus.set('Guardado automáticamente en este navegador');
      } catch {
        this.storageStatus.set('No se pudieron guardar los cambios en este navegador');
      }
    });
  }

  updateActivityDuration(
    activityId: string,
    dayId: DayId,
    field: DurationField,
    value: number | string,
  ): void {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    const safeValue = Math.min(field === 'hours' ? 24 : 59, Math.max(0, Math.trunc(parsedValue)));
    this.activities.update((activities) =>
      activities.map((activity) => {
        if (activity.id !== activityId) {
          return activity;
        }

        const currentMinutes = activity.minutesByDay[dayId];
        let hours = Math.floor(currentMinutes / 60);
        let minutes = currentMinutes % 60;
        if (field === 'hours') {
          hours = safeValue;
          if (hours === 24) {
            minutes = 0;
          }
        } else {
          minutes = safeValue;
          if (minutes > 0 && hours === 24) {
            hours = 23;
          }
        }

        return {
          ...activity,
          minutesByDay: { ...activity.minutesByDay, [dayId]: hours * 60 + minutes },
        };
      }),
    );
  }

  durationPart(activity: Activity, dayId: DayId, field: DurationField): number {
    const minutes = activity.minutesByDay[dayId];
    return field === 'hours' ? Math.floor(minutes / 60) : minutes % 60;
  }

  toggleBuiltIn(kind: BuiltInActivityKind): void {
    this.activities.update((activities) => {
      const existing = activities.find((activity) => activity.kind === kind);
      if (existing) {
        return activities.map((activity) =>
          activity.id === existing.id ? { ...activity, enabled: !activity.enabled } : activity,
        );
      }

      const definition = kind === 'work'
        ? { name: 'Trabajo', color: ACTIVITY_COLORS[1] }
        : { name: 'Almuerzo', color: ACTIVITY_COLORS[2] };
      return [
        ...activities,
        {
          id: kind,
          kind,
          ...definition,
          enabled: true,
          distraction: false,
          minutesByDay: { ...ZERO_MINUTES },
        },
      ];
    });
  }

  isBuiltInEnabled(kind: BuiltInActivityKind): boolean {
    return this.activities().some((activity) => activity.kind === kind && activity.enabled);
  }

  addActivity(): void {
    const id = `activity-${this.nextActivityId++}`;
    this.activities.update((activities) => [
      ...activities,
      {
        id,
        kind: 'custom',
        name: `Actividad ${this.nextActivityId - 1}`,
        color: ACTIVITY_COLORS[(this.nextActivityId - 1) % ACTIVITY_COLORS.length],
        enabled: true,
        distraction: false,
        minutesByDay: { ...ZERO_MINUTES },
      },
    ]);
  }

  renameActivity(activityId: string, name: string): void {
    this.activities.update((activities) =>
      activities.map((activity) =>
        activity.id === activityId && activity.kind === 'custom'
          ? { ...activity, name: name.slice(0, 30) }
          : activity,
      ),
    );
  }

  finalizeActivityName(activityId: string): void {
    this.activities.update((activities) =>
      activities.map((activity) => {
        if (activity.id !== activityId || activity.kind !== 'custom' || activity.name.trim()) {
          return activity;
        }
        return { ...activity, name: 'Actividad' };
      }),
    );
  }

  removeActivity(activityId: string): void {
    this.activities.update((activities) => activities.filter((activity) => activity.id !== activityId));
  }

  toggleDistraction(activityId: string): void {
    this.activities.update((activities) =>
      activities.map((activity) =>
        activity.id === activityId ? { ...activity, distraction: !activity.distraction } : activity,
      ),
    );
  }

  exportData(): void {
    const contents = JSON.stringify({ version: 1, activities: this.activities() }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ritmo-respaldo.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.storageStatus.set('Respaldo JSON descargado');
  }

  async importFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      this.importData(await file.text());
    } catch {
      this.storageStatus.set('No se pudo leer el archivo JSON');
    } finally {
      input.value = '';
    }
  }

  importData(contents: string): void {
    try {
      const parsed: unknown = JSON.parse(contents);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('version' in parsed) ||
        parsed.version !== 1 ||
        !('activities' in parsed) ||
        !isActivityList(parsed.activities)
      ) {
        this.storageStatus.set('El archivo no tiene un formato de respaldo válido');
        return;
      }

      this.activities.set(parsed.activities);
      this.nextActivityId = nextCustomActivityId(parsed.activities);
      this.storageStatus.set('Respaldo importado correctamente');
    } catch {
      this.storageStatus.set('El archivo no contiene JSON válido');
    }
  }

  activityName(activity: Activity): string {
    return activity.name.trim() || 'Actividad';
  }

  dayTotalMinutes(dayId: DayId): number {
    return this.activeActivities().reduce((total, activity) => total + activity.minutesByDay[dayId], 0);
  }

  dayHasOverbooking(dayId: DayId): boolean {
    return this.dayTotalMinutes(dayId) > 24 * 60;
  }

  weekOverbooked(): boolean {
    return WEEKDAYS.some((day) => this.dayHasOverbooking(day.id));
  }

  chartGradient(): string {
    const entries = this.chartEntries();
    if (entries.length === 0) {
      return 'conic-gradient(#282e29 0deg 360deg)';
    }

    let start = 0;
    const slices = entries.map((entry) => {
      const end = start + entry.percent * 3.6;
      const slice = `${entry.color} ${start}deg ${end}deg`;
      start = end;
      return slice;
    });
    return `conic-gradient(${slices.join(', ')})`;
  }

  distractionChartGradient(): string {
    const entries = this.distractionChartEntries();
    if (entries.length === 0) {
      return 'conic-gradient(#282e29 0deg 360deg)';
    }

    let start = 0;
    const slices = entries.map((entry) => {
      const end = start + entry.percent * 3.6;
      const slice = `${entry.color} ${start}deg ${end}deg`;
      start = end;
      return slice;
    });
    return `conic-gradient(${slices.join(', ')})`;
  }

  chartPeriodName(): string {
    if (this.chartMode() === 'week') {
      return 'de la semana';
    }
    return `del ${this.selectedChartDayName().toLowerCase()}`;
  }

  selectedChartDayName(): string {
    return WEEKDAYS.find((day) => day.id === this.selectedChartDay())?.name ?? 'día';
  }

  chartAriaLabel(): string {
    const period = this.chartMode() === 'day' ? this.selectedChartDayName() : 'semana';
    return `Gráfico de distribución de tiempo para ${period}`;
  }

  chartPercent(percent: number): string {
    return `${Math.round(percent)}%`;
  }

  setChartMode(mode: ChartMode): void {
    this.chartMode.set(mode);
  }

  formatDuration(totalMinutes: number): string {
    const roundedMinutes = Math.round(totalMinutes);
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
  }

  resetExample(): void {
    this.activities.set(createExampleActivities());
    this.nextActivityId = 1;
    this.chartMode.set('day');
    this.selectedChartDay.set('mon');
    this.includeUnassigned.set(true);
  }
}
