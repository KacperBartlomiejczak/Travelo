import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlanDayPicker } from '@/features/plan/PlanDayPicker';
import i18n from '@/i18n';

const dates = ['2026-11-20', '2026-11-21', '2026-11-22'];

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

describe('PlanDayPicker', () => {
  it('renders one chip per day with weekday and day number, and a full-date label', async () => {
    await render(<PlanDayPicker dates={dates} selected={0} onSelect={jest.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText('20')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: /piątek, 20 listopada 2026/ })).toBeOnTheScreen();
  });

  it('marks only the selected chip as selected', async () => {
    await render(<PlanDayPicker dates={dates} selected={1} onSelect={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[1]).toBeSelected();
    expect(tabs[0]).not.toBeSelected();
  });

  it('reports the tapped day index', async () => {
    const onSelect = jest.fn();
    await render(<PlanDayPicker dates={dates} selected={0} onSelect={onSelect} />);
    await fireEvent.press(screen.getAllByRole('tab')[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
