import { render, screen } from '@testing-library/react';
import PipelineFunnelChart from '../PipelineFunnelChart';

const items = [
  { name: 'Qualifying', value: 4500000 },
  { name: 'Analysis', value: 3200000 },
  { name: 'Funding', value: 1200000 },
];

describe('PipelineFunnelChart', () => {
  it('renders all pipeline stage names', () => {
    render(<PipelineFunnelChart items={items} />);
    expect(screen.getByText('Qualifying')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Funding')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<PipelineFunnelChart items={[]} />);
    expect(screen.getByText('No pipeline data')).toBeInTheDocument();
  });
});
