import { fireEvent, render, screen } from '@testing-library/react-native';

import { InterestChips } from '@/components/InterestChips';
import i18n from '@/i18n';
import { INTEREST_GROUPS, InterestGroupSchema, InterestTagSchema, type InterestTag } from '@/schemas';

beforeEach(async () => {
  await i18n.changeLanguage('pl');
});

const GROUP_LABELS = ['Zabawa', 'Natura', 'Kultura', 'Jedzenie', 'Aktywnie', 'Relaks i inne'];

describe('InterestChips (extracted from FriendCard, auth-onboarding step 8)', () => {
  it('shows the 6 groups, in order, each with its label', async () => {
    await render(<InterestChips selected={[]} onChange={() => {}} />);
    expect(InterestGroupSchema.options).toHaveLength(6);
    for (const label of GROUP_LABELS) expect(screen.getByText(label)).toBeTruthy();
    const shown = screen.getAllByText(new RegExp(`^(${GROUP_LABELS.join('|')})$`)).map((node) => node.props.children);
    expect(shown).toEqual(GROUP_LABELS);
  });

  it('shows the 17 interests as chips, none selected when nothing is', async () => {
    await render(<InterestChips selected={[]} onChange={() => {}} />);
    expect(InterestTagSchema.options).toHaveLength(17);
    expect(Object.values(INTEREST_GROUPS).flat()).toHaveLength(17);
    expect(screen.getAllByRole('checkbox')).toHaveLength(17);
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: 'Muzea' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Aquaparki i parki rozrywki' })).toBeTruthy();
  });

  it('marks the selected interests as checked', async () => {
    await render(<InterestChips selected={['museums', 'beaches']} onChange={() => {}} />);
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Muzea', checked: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Plaże', checked: true })).toBeTruthy();
  });

  it('adds an interest to the end of the selection when it is pressed', async () => {
    const onChange = jest.fn<void, [InterestTag[]]>();
    await render(<InterestChips selected={['museums']} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Plaże' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['museums', 'beaches']);
  });

  it('removes a selected interest when it is pressed again', async () => {
    const onChange = jest.fn<void, [InterestTag[]]>();
    await render(<InterestChips selected={['museums', 'beaches']} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Muzea' }));
    expect(onChange).toHaveBeenCalledWith(['beaches']);
  });

  it('can be disabled: no chip reacts', async () => {
    const onChange = jest.fn();
    await render(<InterestChips selected={['museums']} onChange={onChange} disabled />);
    for (const chip of screen.getAllByRole('checkbox')) expect(chip).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Plaże' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await render(<InterestChips selected={[]} onChange={() => {}} />);
    expect(screen.getByText('Fun')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Museums' })).toBeTruthy();
  });
});
