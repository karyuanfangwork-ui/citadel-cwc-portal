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
    expect(screen.getByText((content) => content.startsWith('Qualifying'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith('Analysis'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith('Funding'))).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<PipelineFunnelChart items={[]} />);
    expect(screen.getByText('No pipeline data')).toBeInTheDocument();
  });
});
