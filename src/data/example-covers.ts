import { Asset } from 'expo-asset';

import type { ExampleCovers } from './example-trips';

/** Bundled example photos (D9) as URIs, like a photo picked from the gallery; works on iOS, Android and web (D10). */
export function exampleCovers(): ExampleCovers {
  return {
    lisbon: Asset.fromModule(require('../../assets/images/examples/lisbon.jpg')).uri,
    beijing: Asset.fromModule(require('../../assets/images/examples/beijing.jpg')).uri,
  };
}
