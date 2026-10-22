import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, StyleSheet } from 'react-native';

import { InterestChips } from '@/components/InterestChips';
import i18n from '@/i18n';
import { INTEREST_GROUPS, InterestGroupSchema, InterestTagSchema, type InterestTag } from '@/schemas';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

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

  // theme-split D11: the first tap toggles the chip (the scroll view lets it through) and the keyboard closes along the way.
  it('closes the keyboard when a chip is pressed, and still toggles the chip', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const onChange = jest.fn<void, [InterestTag[]]>();
    await render(<InterestChips selected={['museums']} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Plaże' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['museums', 'beaches']);
    dismiss.mockRestore();
  });

  it('can be disabled: no chip reacts', async () => {
    const onChange = jest.fn();
    await render(<InterestChips selected={['museums']} onChange={onChange} disabled />);
    for (const chip of screen.getAllByRole('checkbox')) expect(chip).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Plaże' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  // coderabbit-pr21-fixes A3: a chip has a 44dp touch target around its visual height (4dp slop above and below), so the rows
  // must be touchHeight - visualHeight apart, otherwise the touch areas of two wrapped rows overlap.
  it('keeps wrapped chip rows far enough apart that their 44dp touch areas do not overlap', async () => {
    const { chip } = tokens.components;
    await render(<InterestChips selected={[]} onChange={() => {}} />);
    const target = screen.getByRole('checkbox', { name: 'Muzea' });
    const row = target.parent;
    const style = StyleSheet.flatten(row?.props.style);
    expect(style.flexWrap).toBe('wrap');
    expect(style.rowGap).toBe(chip.touchHeight - chip.visualHeight);
    expect(style.rowGap).toBe(tokens.spacing[2]);
    expect(style.columnGap).toBe(tokens.spacing[2]);
    expect(style.gap).toBeUndefined();
  });

  it('labels each group in bodySM text.secondary', async () => {
    await render(<InterestChips selected={[]} onChange={() => {}} />);
    expect(screen.getByText('Zabawa')).toHaveStyle({ ...tokens.typography.styles.bodySM, color: lightTheme.text.secondary });
  });

  it('uses the dark colors in dark mode', async () => {
    await render(<InterestChips selected={['museums']} onChange={() => {}} />, { wrapper: DarkThemeScope });
    expect(screen.getByText('Zabawa')).toHaveStyle({ color: darkTheme.text.secondary });
    expect(screen.getByRole('checkbox', { name: 'Muzea' })).toHaveStyle({ backgroundColor: darkTheme.brand.tint });
  });

  it('speaks English on an English phone', async () => {
    await i18n.changeLanguage('en');
    await render(<InterestChips selected={[]} onChange={() => {}} />);
    expect(screen.getByText('Fun')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Museums' })).toBeTruthy();
  });
});
