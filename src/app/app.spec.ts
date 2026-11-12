import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should show the weekly, monthly, and yearly totals for the example schedule', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Las horas de hoy');
    expect(compiled.textContent).toContain('9 h');
    expect(compiled.textContent).toContain('39 h');
    expect(compiled.textContent).toContain('468 h');
  });

  it('should include optional work and lunch hours in the totals', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.toggleBuiltIn('work');
    app.toggleBuiltIn('lunch');
    app.updateActivityDuration('work', 'mon', 'hours', 8);
    app.updateActivityDuration('lunch', 'mon', 'minutes', 30);

    expect(app.weeklyMinutes()).toBe(1050);
    expect(app.dayTotalMinutes('mon')).toBe(570);
  });

  it('should add and rename custom activities and include them in the chart', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.addActivity();
    const activity = app.activities()[1];
    app.renameActivity(activity.id, 'Guitarra');
    app.updateActivityDuration(activity.id, 'mon', 'minutes', 45);

    expect(app.weeklyMinutes()).toBe(585);
    expect(app.chartEntries().some((entry) => entry.name === 'Guitarra')).toBe(true);
    expect(app.chartEntries().reduce((total, entry) => total + entry.percent, 0)).toBeCloseTo(100);

    app.includeUnassigned.set(false);
    expect(app.chartTotalMinutes()).toBe(105);
    expect(app.chartEntries().reduce((total, entry) => total + entry.percent, 0)).toBeCloseTo(100);
  });

  it('should keep activity durations within the daily limit', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.updateActivityDuration('study', 'mon', 'minutes', 90);
    expect(app.activities()[0].minutesByDay.mon).toBe(119);

    app.updateActivityDuration('study', 'mon', 'hours', 24);
    expect(app.activities()[0].minutesByDay.mon).toBe(1440);

    app.updateActivityDuration('study', 'mon', 'minutes', 15);
    expect(app.activities()[0].minutesByDay.mon).toBe(1395);
    expect(app.dayHasOverbooking('mon')).toBe(false);

    app.toggleBuiltIn('work');
    app.updateActivityDuration('work', 'mon', 'hours', 2);
    expect(app.dayHasOverbooking('mon')).toBe(true);
  });

  it('should restore the example schedule', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.addActivity();
    app.toggleBuiltIn('work');
    app.updateActivityDuration('study', 'mon', 'hours', 0);

    app.resetExample();

    expect(app.weeklyMinutes()).toBe(540);
    expect(app.activities()).toHaveLength(1);
    expect(app.activities()[0].minutesByDay.mon).toBe(60);
    expect(app.includeUnassigned()).toBe(true);
  });

  it('should track distraction time separately and show its breakdown', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.addActivity();
    const activity = app.activities()[1];
    app.renameActivity(activity.id, 'Redes');
    app.updateActivityDuration(activity.id, 'mon', 'minutes', 30);
    app.updateActivityDuration(activity.id, 'tue', 'hours', 1);
    app.toggleDistraction(activity.id);

    expect(app.weeklyDistractionMinutes()).toBe(90);
    expect(app.yearlyDistractionMinutes()).toBe(4680);
    expect(app.distractionChartEntries()).toEqual([
      expect.objectContaining({ name: 'Redes', minutes: 30, percent: 100 }),
    ]);

    app.setChartMode('week');
    expect(app.distractionChartEntries()[0].minutes).toBe(90);
  });

  it('should import a valid backup, advance activity ids, and reject invalid data', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.importData(JSON.stringify({
      version: 1,
      activities: [{
        id: 'activity-8',
        kind: 'custom',
        name: 'Video',
        color: '#a8ce83',
        enabled: true,
        distraction: true,
        minutesByDay: { mon: 75, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
      }],
    }));

    expect(app.weeklyDistractionMinutes()).toBe(75);
    app.addActivity();
    expect(app.activities()[1].id).toBe('activity-9');

    app.importData('{"version":2,"activities":[]}');
    expect(app.weeklyDistractionMinutes()).toBe(75);
    expect(app.storageStatus()).toContain('formato');
  });

  it('should save activity changes in browser storage', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.toggleDistraction('study');
    fixture.detectChanges();
    await fixture.whenStable();

    const saved = JSON.parse(localStorage.getItem('ritmo-time-data') ?? '{}');
    expect(saved.activities[0].distraction).toBe(true);
  });
});
