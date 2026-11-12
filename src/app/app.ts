import { Component, computed, signal } from '@angular/core';
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

function createExampleActivities(): Activity[] {
  return [
    {
      id: 'study',
      kind: 'custom',
      name: 'Estudio',
      color: ACTIVITY_COLORS[0],
      enabled: true,
      minutesByDay: { mon: 60, tue: 120, wed: 60, thu: 120, fri: 60, sat: 120, sun: 0 },
    },
  ];
}

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  readonly weekdays = WEEKDAYS;
  readonly activities = signal<Activity[]>(createExampleActivities());
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

  private nextActivityId = 1;

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
