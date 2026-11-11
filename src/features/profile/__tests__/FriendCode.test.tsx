import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import i18n from '@/i18n';

import { FriendCode } from '../FriendCode';

afterEach(() => jest.restoreAllMocks());

describe('FriendCode (profile-upgrade D15)', () => {
  it('shows the caption and the code, and reads the code char by char', async () => {
    await i18n.changeLanguage('pl');
    await render(<FriendCode code="AB12CD" />);
    expect(screen.getByText('Twój kod znajomego')).toBeTruthy();
    expect(screen.getByText('AB12CD')).toBeTruthy();
    expect(screen.getByLabelText('Twój kod znajomego: A B 1 2 C D')).toBeTruthy();
  });

  it.each([
    ['pl', 'Udostępnij kod znajomego'],
    ['en', 'Share friend code'],
  ])('shares a message containing the code once (%s)', async (lng, label) => {
    await i18n.changeLanguage(lng);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(<FriendCode code="AB12CD" />);
    await fireEvent.press(screen.getByLabelText(label));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].message).toContain('AB12CD');
  });

  it('stays silent when sharing fails', async () => {
    await i18n.changeLanguage('en');
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('cancelled'));
    await render(<FriendCode code="AB12CD" />);
    await fireEvent.press(screen.getByLabelText('Share friend code'));
    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.getByText('AB12CD')).toBeTruthy();
  });
});
