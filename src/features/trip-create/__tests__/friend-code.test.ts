import { ServerUnreachableError } from '@/data/errors';
import { friendCodeStatus, type CodeLookup } from '@/features/trip-create/friend-code';

const OLA = { username: 'ola_b', interests: ['museums' as const] };
const OWN = 'K7PQ2D';

const base = { text: '', linked: false, offline: false, ownCode: OWN, takenCodes: [] as string[] };

describe('friendCodeStatus without an answer from the server', () => {
  it.each([
    ['nothing typed', { text: '' }, 'empty'],
    ['only spaces', { text: '   ' }, 'empty'],
    ['1 character', { text: 'A' }, 'incomplete'],
    ['5 characters', { text: 'ABCDE' }, 'incomplete'],
    ['5 characters and a space', { text: ' ABCDE ' }, 'incomplete'],
    ['a look-alike letter', { text: 'ABCDE0' }, 'unknown'],
    ['letters that are not in the alphabet', { text: 'ABCDEL' }, 'unknown'],
    ['a space inside', { text: 'AB CDE' }, 'unknown'],
    ['the own code', { text: OWN }, 'own'],
    ['the own code in lowercase with spaces', { text: ` ${OWN.toLowerCase()} ` }, 'own'],
    ['a code another card has', { text: '5ZMRX8', takenCodes: ['5ZMRX8'] }, 'duplicate'],
    ['a plain new code', { text: '5ZMRX8' }, 'checking'],
    ['a plain new code in lowercase', { text: '5zmrx8' }, 'checking'],
    ['a plain new code while the own code is not known yet', { text: '5ZMRX8', ownCode: undefined }, 'checking'],
    ['a code another card does not have', { text: '5ZMRX8', takenCodes: ['AAAAAA'] }, 'checking'],
    ['offline, nothing typed', { text: '', offline: true }, 'offline'],
    ['offline, a short code', { text: 'AB', offline: true }, 'offline'],
    ['offline, a plain new code', { text: '5ZMRX8', offline: true }, 'offline'],
    ['offline, the own code', { text: OWN, offline: true }, 'offline'],
    ['a card that was found', { text: '5ZMRX8', linked: true }, 'found'],
    ['a card that was found, offline', { text: '5ZMRX8', linked: true, offline: true }, 'found'],
    ['a card that was found, whatever the other cards have', { text: '5ZMRX8', linked: true, takenCodes: ['5ZMRX8'] }, 'found'],
  ])('%s → %s', (_name, input, status) => {
    expect(friendCodeStatus({ ...base, ...input }).status).toBe(status);
  });

  it('gives the normalised code when the text is a possible friend code, else null', () => {
    expect(friendCodeStatus({ ...base, text: ' 5zmrx8 ' }).code).toBe('5ZMRX8');
    expect(friendCodeStatus({ ...base, text: 'ABCDE0' }).code).toBeNull();
    expect(friendCodeStatus({ ...base, text: 'AB' }).code).toBeNull();
    expect(friendCodeStatus({ ...base, text: '' }).code).toBeNull();
  });
});

describe('friendCodeStatus with the answer of the lookup', () => {
  const asked = { ...base, text: '5ZMRX8' };
  const lookup = (answer: Partial<CodeLookup>): CodeLookup => ({ data: undefined, error: null, isError: false, ...answer });

  it.each([
    ['still waiting', lookup({}), 'checking'],
    ['nobody has the code', lookup({ data: null }), 'unknown'],
    ['a friend was found', lookup({ data: OLA }), 'found'],
    ['the server cannot be reached', lookup({ isError: true, error: new ServerUnreachableError('offline') }), 'unreachable'],
    ['any other error', lookup({ isError: true, error: new Error('boom') }), 'failed'],
    ['an error that is not an Error', lookup({ isError: true, error: 'boom' }), 'failed'],
  ])('%s → %s', (_name, answer, status) => {
    expect(friendCodeStatus({ ...asked, lookup: answer }).status).toBe(status);
  });

  it('ignores the lookup when the phone had already decided', () => {
    const found = lookup({ data: OLA });
    expect(friendCodeStatus({ ...asked, text: OWN, lookup: found }).status).toBe('own');
    expect(friendCodeStatus({ ...asked, takenCodes: ['5ZMRX8'], lookup: found }).status).toBe('duplicate');
    expect(friendCodeStatus({ ...asked, offline: true, lookup: found }).status).toBe('offline');
    expect(friendCodeStatus({ ...asked, text: 'AB', lookup: found }).status).toBe('incomplete');
  });
});
