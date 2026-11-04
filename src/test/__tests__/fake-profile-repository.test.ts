import { createInMemoryProfileRepository } from '@/data/profile-repository';
import { delegatingProfileRepository, repositoryWithProfile, resetAppProfileRepository, setAppProfileRepository } from '@/test/fake-profile-repository';

afterEach(resetAppProfileRepository);

describe('delegatingProfileRepository', () => {
  it('forwards the account methods to the current fake', async () => {
    const base = await repositoryWithProfile(createInMemoryProfileRepository({ newId: () => '00000000-0000-4000-8000-000000000002' }));
    const spies = {
      updateProfile: jest.spyOn(base, 'updateProfile'),
      changeAvatar: jest.spyOn(base, 'changeAvatar'),
      removeAvatar: jest.spyOn(base, 'removeAvatar'),
      deleteAccount: jest.spyOn(base, 'deleteAccount'),
    };
    setAppProfileRepository(base);

    await delegatingProfileRepository.updateProfile({ username: 'ola', interests: ['museums'] });
    await delegatingProfileRepository.changeAvatar('file:///picked/a.jpg');
    await delegatingProfileRepository.removeAvatar();
    await delegatingProfileRepository.deleteAccount('ola');

    expect(spies.updateProfile).toHaveBeenCalledWith({ username: 'ola', interests: ['museums'] });
    expect(spies.changeAvatar).toHaveBeenCalledWith('file:///picked/a.jpg');
    expect(spies.removeAvatar).toHaveBeenCalledTimes(1);
    expect(spies.deleteAccount).toHaveBeenCalledWith('ola');
  });
});
