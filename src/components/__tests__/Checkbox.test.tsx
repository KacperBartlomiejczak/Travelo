import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Checkbox } from '@/components/Checkbox';

describe('Checkbox', () => {
  it('is a checkbox that reports the opposite value on press', async () => {
    const onChange = jest.fn();
    await render(<Checkbox checked={false} onChange={onChange} label="I agree" />);
    const box = screen.getByRole('checkbox');
    expect(box).not.toBeChecked();
    await fireEvent.press(box);
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('I agree')).toBeTruthy();
  });

  it('exposes the checked state and shows a check mark', async () => {
    const onChange = jest.fn();
    await render(<Checkbox checked onChange={onChange} label="I agree" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByTestId('checkbox-check', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not press when disabled and exposes it', async () => {
    const onChange = jest.fn();
    await render(<Checkbox checked={false} onChange={onChange} label="I agree" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a label that can hold a link', async () => {
    await render(<Checkbox checked={false} onChange={() => {}} label={<Text>Accept the <Text>terms</Text></Text>} testID="terms" />);
    expect(screen.getByText('terms')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    expect(screen.getByTestId('terms')).toBeTruthy();
  });
});
