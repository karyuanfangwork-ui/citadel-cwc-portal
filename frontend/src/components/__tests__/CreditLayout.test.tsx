import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import CreditLayout from '../CreditLayout';

vi.mock('../CreditNav', () => ({ default: () => <nav aria-label="Credit navigation" /> }));

describe('CreditLayout', () => {
  it('keeps the routed content in the parent-owned single scroll area', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/credit']}>
        <Routes>
          <Route path="/credit" element={<CreditLayout />}>
            <Route index element={<main data-testid="credit-dashboard-outlet">Dashboard</main>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const module = container.querySelector('.credit-module') as HTMLElement;
    const content = module.querySelector('.flex-1') as HTMLElement;
    const outlet = screen.getByTestId('credit-dashboard-outlet');

    expect(module.style.minHeight).toBe('100%');
    expect(module.style.minHeight).not.toMatch(/100vh/);
    expect(module.className).not.toMatch(/(?:^|\s)(?:h-screen|min-h-screen)(?:\s|$)/);
    expect(content.className).not.toContain('overflow-auto');
    expect(content.style.overflow).not.toBe('auto');
    expect(content).toContainElement(outlet);
  });
});
