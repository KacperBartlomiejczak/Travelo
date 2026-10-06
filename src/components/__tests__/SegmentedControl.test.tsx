import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from '@/components/SegmentedControl';
import { lightTheme } from '@/theme/theme';

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

  it('styles the selected option as surface + primary text, the rest as secondary text (§10.14)', async () => {
    await render(<SegmentedControl label="Waluta" options={options} value="THB" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'THB' })).toHaveStyle({ backgroundColor: lightTheme.colors.surface.default });
    expect(screen.getByText('THB')).toHaveStyle({ color: lightTheme.colors.text.primary });
    expect(screen.getByText('PLN')).toHaveStyle({ color: lightTheme.colors.text.secondary });
    expect(screen.getByLabelText('Waluta')).toHaveStyle({
      minHeight: 52,
      borderRadius: lightTheme.radius.segmented,
      backgroundColor: lightTheme.colors.surface.secondary,
    });
  });
});
