import { testHooks } from './env';

if (testHooks) {
  const hooks: NonNullable<Window['__hooks']> = {
    ready: true,
    longTasks: [],
    errors: [],
  };
  window.__hooks = hooks;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        hooks.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // longtask unsupported (WebKit)
  }
}
