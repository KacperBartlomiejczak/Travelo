import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { darkTheme, lightTheme } from '@/theme/theme';
import { tokens } from '@/theme/tokens';
import { DarkThemeScope } from '@/theme/useTheme';

const { segmentedControl: segmented, focusRing } = tokens.components;
const flat = (element: ReturnType<typeof screen.getByRole>) => StyleSheet.flatten(element.props.style);
const press = (element: ReturnType<typeof screen.getByRole>) =>
  fireEvent(element, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: jest.fn() });

const options = [
  { value: 'THB', label: 'THB' },
  { value: 'PLN', label: 'PLN' },
];

describe('SegmentedControl', () => {
  it('is a labelled group of radio options', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={onChange} />);
    // The group is not an accessibility element itself (that would merge the options for VoiceOver).
    expect(screen.getByLabelText('Waluta').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'THB' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'PLN' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'PLN' }));
    expect(onChange).toHaveBeenCalledWith('PLN');
  });

  // Sunline Editorial §8.15.
  it('is a 44dp background.sunken container with 4dp padding and concentric corners', async () => {
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={() => {}} />);
    expect(screen.getByLabelText('Waluta')).toHaveStyle({
      minHeight: segmented.height,
      padding: segmented.padding,
      borderRadius: segmented.segmentRadius + segmented.padding,
      backgroundColor: lightTheme.background.sunken,
    });
  });

  it('draws the selected segment as surface.elevated with elevation.level1 and text.primary labelMD, the rest in text.secondary', async () => {
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={() => {}} />);
    const selected = screen.getByRole('radio', { name: 'THB' });
    expect(selected).toHaveStyle({ backgroundColor: lightTheme.surface.elevated, borderRadius: segmented.segmentRadius });
    expect(flat(selected)).toMatchObject(lightTheme.elevation.level1);
    expect(screen.getByText('THB')).toHaveStyle({ ...tokens.typography.styles.labelMD, color: lightTheme.text.primary });
    const other = screen.getByRole('radio', { name: 'PLN' });
    expect(flat(other).backgroundColor).toBeUndefined();
    expect(flat(other).shadowOpacity).toBeUndefined();
    expect(screen.getByText('PLN')).toHaveStyle({ ...tokens.typography.styles.labelMD, color: lightTheme.text.secondary });
  });

  it('uses a 1dp border instead of a shadow for the selected segment in dark mode', async () => {
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={() => {}} />, { wrapper: DarkThemeScope });
    expect(screen.getByLabelText('Waluta')).toHaveStyle({ backgroundColor: darkTheme.background.sunken });
    const selected = screen.getByRole('radio', { name: 'THB' });
    expect(selected).toHaveStyle({ backgroundColor: darkTheme.surface.elevated });
    expect(flat(selected)).toMatchObject(darkTheme.elevation.level1);
    expect(flat(selected).borderWidth).toBe(1);
    expect(flat(selected).shadowOpacity).toBe(0);
    expect(screen.getByText('PLN')).toHaveStyle({ color: darkTheme.text.secondary });
  });

  it('gives an unselected segment an underlay while pressed', async () => {
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={() => {}} />);
    await press(screen.getByRole('radio', { name: 'PLN' }));
    expect(screen.getByRole('radio', { name: 'PLN' })).toHaveStyle({ backgroundColor: lightTheme.surface.primary });
  });

  it('draws a 2dp border.focus border on the focused segment', async () => {
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={() => {}} />);
    await fireEvent(screen.getByRole('radio', { name: 'THB' }), 'focus');
    expect(screen.getByRole('radio', { name: 'THB' })).toHaveStyle({ borderWidth: focusRing.width, borderColor: lightTheme.border.focus });
    await fireEvent(screen.getByRole('radio', { name: 'THB' }), 'blur');
    expect(screen.getByRole('radio', { name: 'THB' })).not.toHaveStyle({ borderColor: lightTheme.border.focus });
  });
});
