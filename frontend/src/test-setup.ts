import "@testing-library/jest-dom";

// jsdom (die Test-Umgebung) implementiert ResizeObserver nicht, das Recharts'
// ResponsiveContainer intern braucht, um sich an die Container-Größe
// anzupassen. Ein reines No-op-Mock reicht nicht: ResponsiveContainer
// rendert sein <svg> erst, NACHDEM der ResizeObserver eine reale Größe
// gemeldet hat - in jsdom ist jedes Element sonst dauerhaft 0x0. Der Mock
// simuliert deshalb sofort bei observe() eine plausible Container-Größe.
class ResizeObserverMock {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 500, height: 300 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }

  unobserve() {}
  disconnect() {}
}

// @ts-expect-error - jsdom kennt ResizeObserver nicht, wir polyfillen es nur für Tests.
global.ResizeObserver = ResizeObserverMock;
