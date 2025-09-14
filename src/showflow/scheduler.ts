import cron from 'node-cron';

export type ShowAction = { kind: 'obs_scene' | 'obs_hotkey' | 'vts_expression' | 'persona' | 'say'; value: string };
export type ShowStep = { cron: string; actions: ShowAction[] };

export class ShowFlowScheduler {
  private tasks: cron.ScheduledTask[] = [];
  load(steps: ShowStep[], exec: (a: ShowAction) => Promise<void>) {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    for (const step of steps) {
      const task = cron.schedule(step.cron, async () => {
        for (const a of step.actions) await exec(a);
      });
      this.tasks.push(task);
    }
  }
  stop() { this.tasks.forEach(t => t.stop()); }
}

