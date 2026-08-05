import { render, screen } from '@testing-library/react';
import ProductMixChart from '../ProductMixChart';

const items = [
  { name: 'SME Loan', value: 4500000 },
  { name: 'Personal', value: 2100000 },
  { name: 'Mortgage', value: 1800000 },
];

describe('ProductMixChart', () => {
  it('renders legend items', () => {
    render(<ProductMixChart items={items} />);
    expect(screen.getByText('SME Loan')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Mortgage')).toBeInTheDocument();
  });

  it('renders Total label', () => {
    render(<ProductMixChart items={items} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
