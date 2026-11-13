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
    expect(app.activities().some((activity) => activity.id === 'activity-9')).toBe(true);

    app.importData('{"version":2,"activities":[]}');
    expect(app.weeklyDistractionMinutes()).toBe(75);
    expect(app.storageStatus()).toContain('formato');
  });

  it('should save activity changes in browser storage', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.addActivity();
    const activity = app.activities().find((item) => item.kind === 'custom');
    if (!activity) {
      throw new Error('Expected a custom activity');
    }
    app.toggleDistraction(activity.id);
    fixture.detectChanges();
    await fixture.whenStable();

    const saved = JSON.parse(localStorage.getItem('ritmo-time-data') ?? '{}');
    expect(saved.baseActivities.find((item: { id: string }) => item.id === activity.id).distraction).toBe(true);
  });

  it('should keep Study fixed and prevent it from being marked as a distraction', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    app.toggleDistraction('study');
    app.removeActivity('study');

    expect(app.activities().find((activity) => activity.id === 'study')).toMatchObject({
      kind: 'study',
      name: 'Estudio',
      distraction: false,
    });
  });

  it('should clone the base schedule, edit an alternative, and compare the two', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.createOrResetAlternative();
    app.updateActivityDuration('study', 'mon', 'hours', 2);
    app.addActivity();
    const distraction = app.activities().find((activity) => activity.kind === 'custom');
    if (!distraction) {
      throw new Error('Expected the alternative to contain a custom activity');
    }
    app.renameActivity(distraction.id, 'Redes');
    app.updateActivityDuration(distraction.id, 'mon', 'minutes', 30);
    app.toggleDistraction(distraction.id);

    expect(app.scenarioComparison()).toMatchObject({
      baseMinutes: 540,
      alternativeMinutes: 630,
      baseStudyMinutes: 540,
      alternativeStudyMinutes: 600,
      baseDistractionMinutes: 0,
      alternativeDistractionMinutes: 30,
    });
    expect(app.impactEntries().map((entry) => entry.name)).toEqual(['Estudio', 'Redes']);
    expect(app.impactPercent(540, 'week')).toBe('5.4%');

    app.switchScenario('base');
    expect(app.activities().find((activity) => activity.id === 'study')?.minutesByDay.mon).toBe(60);
    app.switchScenario('alternative');
    expect(app.activities().find((activity) => activity.id === 'study')?.minutesByDay.mon).toBe(120);
  });

  it('should persist the base and alternative without creating a history', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.createOrResetAlternative();
    app.updateActivityDuration('study', 'mon', 'hours', 3);
    fixture.detectChanges();
    await fixture.whenStable();

    const saved = JSON.parse(localStorage.getItem('ritmo-time-data') ?? '{}');
    expect(saved.version).toBe(2);
    expect(saved.baseActivities.find((activity: { id: string }) => activity.id === 'study').minutesByDay.mon).toBe(60);
    expect(saved.alternativeActivities.find((activity: { id: string }) => activity.id === 'study').minutesByDay.mon).toBe(180);

    const restoredFixture = TestBed.createComponent(App);
    const restoredApp = restoredFixture.componentInstance;
    expect(restoredApp.activeScenario()).toBe('alternative');
    expect(restoredApp.weeklyStudyMinutes()).toBe(660);
  });
});
