type Counter = { inc: (labels?: Record<string,string>, value?: number) => void };
type Histogram = { observe: (labels: Record<string,string>, value: number) => void };

class SimpleCounter implements Counter {
  private name: string; private help: string; private values: Map<string, number> = new Map();
  constructor(name: string, help: string) { this.name = name; this.help = help; }
  inc(labels?: Record<string,string>, value = 1) {
    const key = labels ? JSON.stringify(labels) : '{}';
    this.values.set(key, (this.values.get(key) || 0) + value);
  }
  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const [k, v] of this.values.entries()) {
      const lbl = k === '{}' ? '' : renderLabels(JSON.parse(k));
      lines.push(`${this.name}${lbl} ${v}`);
    }
    return lines.join('\n');
  }
}

class SimpleHistogram implements Histogram {
  private name: string; private help: string; private samples: Array<{ l: Record<string,string>; v: number }> = [];
  constructor(name: string, help: string) { this.name = name; this.help = help; }
  observe(labels: Record<string,string>, value: number) { this.samples.push({ l: labels, v: value }); }
  render(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const s of this.samples) {
      lines.push(`${this.name}_sum${renderLabels(s.l)} ${s.v}`);
    }
    return lines.join('\n');
  }
}

function renderLabels(labels: Record<string,string>): string {
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
  return parts.length ? `{${parts.join(',')}}` : '';
}

export const metrics = {
  counters: {
    http_requests_total: new SimpleCounter('http_requests_total', 'Total HTTP requests'),
    chat_replies_total: new SimpleCounter('chat_replies_total', 'Total chat replies sent'),
    eventsub_redeems_total: new SimpleCounter('eventsub_redeems_total', 'Total EventSub redeems observed'),
    memory_pruned_total: new SimpleCounter('memory_pruned_total', 'Total messages pruned by retention'),
    backups_total: new SimpleCounter('backups_total', 'Total DB backups created'),
    summaries_total: new SimpleCounter('summaries_total', 'Total user summaries created')
  },
  histograms: {
    tts_latency_ms: new SimpleHistogram('tts_latency_ms', 'TTS synthesis latency in ms'),
    llm_latency_ms: new SimpleHistogram('llm_latency_ms', 'LLM response latency in ms')
  },
  renderAll(): string {
    return [
      this.counters.http_requests_total.render(),
      this.counters.chat_replies_total.render(),
      this.counters.eventsub_redeems_total.render(),
      this.histograms.tts_latency_ms.render(),
      this.histograms.llm_latency_ms.render()
    ].join('\n');
  }
};

