import { Asset } from 'expo-asset';

import { exampleCovers } from '@/data/example-covers';

describe('exampleCovers (D9, D10)', () => {
  it('resolves the bundled Lisbon and Beijing photos through expo-asset (iOS, Android and web)', () => {
    // In Jest an image `require` is a stub carrying its path.
    const fromModule = jest
      .spyOn(Asset, 'fromModule')
      .mockImplementation((module) => ({ uri: `resolved:${(module as unknown as { testUri: string }).testUri}` }) as unknown as Asset);
    const covers = exampleCovers();
    expect(covers.lisbon).toMatch(/^resolved:.*examples\/lisbon\.jpg$/);
    expect(covers.beijing).toMatch(/^resolved:.*examples\/beijing\.jpg$/);
    expect(fromModule).toHaveBeenCalledTimes(2);
    fromModule.mockRestore();
  });
});
