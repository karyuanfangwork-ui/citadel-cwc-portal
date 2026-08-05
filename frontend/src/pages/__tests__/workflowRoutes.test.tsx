import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WorkflowList from '../../../pages/WorkflowList';

// React Flow is a large browser runtime. Keep route matching tests lightweight;
// its real component is covered by the production build and focused component tests.
vi.mock('../../../pages/WorkflowDesigner', () => ({
  default: () => {
    const params = useParams();
    return <div data-testid="workflow-designer-page">{params.workflowTypeId} {params.versionId}</div>;
  },
}));
import WorkflowDesigner from '../../../pages/WorkflowDesigner';

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/workflows" element={<WorkflowList />} />
        <Route path="/admin/workflows/:workflowTypeId/versions/:versionId" element={<WorkflowDesigner />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('workflow designer routes', () => {
  it('renders the workflow list shell', () => {
    renderRoutes('/admin/workflows');

    expect(screen.getByTestId('workflow-list-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflow Designer' })).toBeInTheDocument();
  });

  it('renders the designer shell with route parameters', () => {
    renderRoutes('/admin/workflows/IT_SIMPLE/versions/version-1');

    const shell = screen.getByTestId('workflow-designer-page');
    expect(shell).toBeInTheDocument();
    expect(shell).toHaveTextContent('IT_SIMPLE');
    expect(shell).toHaveTextContent('version-1');
  });
});
