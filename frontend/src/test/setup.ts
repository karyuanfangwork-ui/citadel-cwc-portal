import '@testing-library/jest-dom';

// jsdom has no ResizeObserver and reports 0x0 element dimensions, so
// Recharts' ResponsiveContainer never renders its children in tests.
// Stub both so chart components measure a real, non-zero size.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error — jsdom doesn't type or implement ResizeObserver
global.ResizeObserver = ResizeObserverStub;

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: 500,
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 300,
});
// jsdom has no real SVG text metrics, which makes Recharts' axis-tick
// collision heuristic assume every label overlaps and hide all but one.
if (typeof SVGElement !== 'undefined') {
  // @ts-expect-error — jsdom's SVGElement has no getBBox implementation
  SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 40, height: 20 });
  // @ts-expect-error — nor getComputedTextLength
  SVGElement.prototype.getComputedTextLength = () => 40;
}

HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    width: 500,
    height: 300,
    top: 0,
    left: 0,
    right: 500,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON() {},
  };
};