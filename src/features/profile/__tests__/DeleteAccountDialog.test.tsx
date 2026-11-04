import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { ServerUnreachableError } from '@/data/errors';
import { createInMemoryProfileRepository, UsernameMismatchError, type ProfileRepository } from '@/data/profile-repository';
import i18n from '@/i18n';
import { AppProviders } from '@/providers/AppProviders';
import { repositoryWithProfile, setAppProfileRepository } from '@/test/fake-profile-repository';
import { useFakeAppSession, type FakeSession } from '@/test/fake-session-source';

import { DeleteAccountDialog } from '../DeleteAccountDialog';

const TITLE = 'Usunąć konto?';
const BODY =
  'Trwale usuniemy Twoje konto, profil i zdjęcie oraz wszystkie podróże, które organizujesz, z planami, wydatkami i zdjęciami. Znikną też u połączonych znajomych. W cudzych podróżach zostaną Twój nick i Twoje wydatki. Tego nie da się cofnąć.';
const FAILED = 'Nie udało się dokończyć usuwania konta. Część zdjęć mogła już zniknąć. Spróbuj ponownie.';
const MISMATCH = 'Twój nick się zmienił. Wpisz aktualny nick.';

let fake: FakeSession;
let base: ProfileRepository;
let deleteAccount: jest.Mock<Promise<void>, [string]>;
const onClose = jest.fn();

async function open() {
  await render(
    <AppProviders>
      <DeleteAccountDialog visible onClose={onClose} />
    </AppProviders>,
  );
  await screen.findByLabelText('Wpisz swój nick: kacper');
}

const field = () => screen.getByLabelText(/^Wpisz swój nick: /);
const confirmButton = () => screen.getByRole('button', { name: 'Usuń konto' });
const cancelButton = () => screen.getByRole('button', { name: 'Anuluj' });
const type = (text: string) => fireEvent.changeText(field(), text);

beforeEach(async () => {
  await i18n.changeLanguage('pl');
  onClose.mockClear();
  fake = useFakeAppSession();
  base = await repositoryWithProfile(createInMemoryProfileRepository());
  deleteAccount = jest.fn(async (_confirmUsername: string) => {});
  setAppProfileRepository({ ...base, deleteAccount });
});

describe('DeleteAccountDialog — content', () => {
  it('shows the warning (D1, D11, A10) with the own nick in the field label, in Polish', async () => {
    await open();
    expect(screen.getByRole('header', { name: TITLE })).toBeTruthy();
    expect(screen.getByText(BODY)).toBeTruthy();
    expect(field()).toBeTruthy();
    expect(confirmButton()).toBeTruthy();
    expect(cancelButton()).toBeTruthy();
  });

  it('is translated to English', async () => {
    await i18n.changeLanguage('en');
    await render(
      <AppProviders>
        <DeleteAccountDialog visible onClose={onClose} />
      </AppProviders>,
    );
    expect(await screen.findByLabelText('Type your nick: kacper')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Delete account?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('moves above the keyboard (D18)', async () => {
    await open();
    // The padding itself follows the keyboard, which Jest does not have: it is checked on a device (manual step).
    expect(within(screen.getByTestId('confirm-dialog-keyboard')).getByLabelText(/^Wpisz swój nick: /)).toBeTruthy();
  });
});

describe('DeleteAccountDialog — the confirm button (D2)', () => {
  it('is disabled with an empty field and with a wrong nick, and then does nothing', async () => {
    await open();
    expect(confirmButton()).toBeDisabled();
    await type('kacpe');
    expect(confirmButton()).toBeDisabled();
    await fireEvent.press(confirmButton());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it.each(['kacper', 'KACPER', ' Kacper  '])('is enabled for the right nick typed as %j', async (typed) => {
    await open();
    await type(typed);
    expect(confirmButton()).toBeEnabled();
  });
});

describe('DeleteAccountDialog — cancel', () => {
  it('calls only onClose, deletes nothing, and clears the field and an earlier error', async () => {
    deleteAccount.mockRejectedValueOnce(new Error('http 500'));
    await open();
    await type('kacper');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(FAILED)).toBeTruthy();

    await fireEvent.press(cancelButton());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
    expect(field().props.value).toBe('');
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(fake.signOut).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountDialog — deleting (D17)', () => {
  it('shows busy on the button, does not close, and a double press is one call', async () => {
    let finish: () => void = () => {};
    deleteAccount.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    await open();
    await type('kacper');
    await fireEvent.press(confirmButton());
    await fireEvent.press(confirmButton());

    await waitFor(() => expect(confirmButton()).toBeBusy());
    expect(screen.getByTestId('text-button-spinner')).toBeTruthy();
    expect(deleteAccount).toHaveBeenCalledTimes(1);

    await fireEvent.press(cancelButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Zamknij', includeHiddenElements: true }));
    await fireEvent(screen.getByTestId('confirm-dialog-modal'), 'requestClose');
    expect(onClose).not.toHaveBeenCalled();
    expect(field().props.value).toBe('kacper');

    finish();
    await waitFor(() => expect(fake.signOut).toHaveBeenCalledTimes(1));
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('sends the nick as typed and signs out on this phone after the server confirmed', async () => {
    await open();
    await type('kacper');
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(fake.signOut).toHaveBeenCalledTimes(1));
    expect(deleteAccount).toHaveBeenCalledWith('kacper');
  });
});

describe('DeleteAccountDialog — padding', () => {
  it('a nick with 60 spaces before it is sent normalized and deletes', async () => {
    await open();
    await type(`${' '.repeat(60)}Kacper`);
    expect(confirmButton()).toBeEnabled();
    await fireEvent.press(confirmButton());
    await waitFor(() => expect(fake.signOut).toHaveBeenCalledTimes(1));
    expect(deleteAccount).toHaveBeenCalledWith('kacper');
  });
});

describe('DeleteAccountDialog — failures (A5, D16)', () => {
  it.each([
    ['a server error', new Error('http 500')],
    ['no answer from the server', new ServerUnreachableError('no answer')],
  ])('%s: the A5 text, the dialog and the nick stay, and a retry works', async (_name, failure) => {
    deleteAccount.mockRejectedValueOnce(failure);
    await open();
    await type('kacper');
    await fireEvent.press(confirmButton());

    expect(await screen.findByText(FAILED)).toBeTruthy();
    expect(screen.getByRole('header', { name: TITLE })).toBeTruthy();
    expect(field().props.value).toBe('kacper');
    expect(confirmButton()).toBeEnabled();
    expect(confirmButton()).not.toBeBusy();
    expect(onClose).not.toHaveBeenCalled();
    expect(fake.signOut).not.toHaveBeenCalled();

    await fireEvent.press(confirmButton());
    await waitFor(() => expect(fake.signOut).toHaveBeenCalledTimes(1));
    expect(deleteAccount).toHaveBeenCalledTimes(2);
  });

  it('a stale nick: the profile is read again, the field is cleared, the D16 text shows (not A5) and the label has the new nick', async () => {
    deleteAccount.mockImplementationOnce(async () => {
      // The nick was changed elsewhere in the meantime; the server answered `username_mismatch` and deleted nothing.
      await base.updateProfile({ username: 'nowynick', interests: ['museums'] });
      throw new UsernameMismatchError('username-mismatch');
    });
    await open();
    await type('kacper');
    await fireEvent.press(confirmButton());

    expect(await screen.findByText(MISMATCH)).toBeTruthy();
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(await screen.findByLabelText('Wpisz swój nick: nowynick')).toBeTruthy();
    expect(field().props.value).toBe('');
    expect(confirmButton()).toBeDisabled();
    expect(fake.signOut).not.toHaveBeenCalled();

    await type('nowynick');
    expect(confirmButton()).toBeEnabled();
  });

  it('a new failure replaces the previous message, only one is shown at a time', async () => {
    deleteAccount.mockRejectedValueOnce(new UsernameMismatchError('username-mismatch')).mockRejectedValueOnce(new Error('http 500'));
    await open();
    await type('kacper');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(MISMATCH)).toBeTruthy();

    await type('kacper');
    await fireEvent.press(confirmButton());
    expect(await screen.findByText(FAILED)).toBeTruthy();
    expect(screen.queryByText(MISMATCH)).toBeNull();
  });
});
