import { render, screen } from '@testing-library/react';
import MonthlyTrendChart from '../MonthlyTrendChart';

const data = [
  { month: 'Mar', wonCount: 3, wonValue: 1200000, leadCount: 45 },
  { month: 'Apr', wonCount: 5, wonValue: 2100000, leadCount: 62 },
  { month: 'May', wonCount: 4, wonValue: 1800000, leadCount: 58 },
  { month: 'Jun', wonCount: 6, wonValue: 2800000, leadCount: 71 },
  { month: 'Jul', wonCount: 8, wonValue: 4200000, leadCount: 89 },
  { month: 'Aug', wonCount: 7, wonValue: 3600000, leadCount: 78 },
];

describe('MonthlyTrendChart', () => {
  it('renders 6 month labels', () => {
    render(<MonthlyTrendChart data={data} />);
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText('Aug')).toBeInTheDocument();
  });
});
