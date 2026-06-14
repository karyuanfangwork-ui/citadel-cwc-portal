import { render, screen } from '@testing-library/react';
import CrmKpiCard from '../CrmKpiCard';

describe('CrmKpiCard', () => {
  it('renders label and value', () => {
    render(<CrmKpiCard label="Today's Leads" value={24} icon="person_add" trend="up" trendLabel="+12% vs yest." trendPositive />);
    expect(screen.getByText("Today's Leads")).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('+12% vs yest.')).toBeInTheDocument();
  });

  it('renders without trend', () => {
    render(<CrmKpiCard label="Accounts" value={142} icon="business" />);
    expect(screen.getByText('142')).toBeInTheDocument();
  });
});
