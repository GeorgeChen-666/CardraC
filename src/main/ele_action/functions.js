import { extractImages, filePathToImageKey } from '../../shared/functions';
import { ImageStorage, OverviewStorage } from '../services/store';

export const refreshCardStorage = (CardList, globalBackground) => {
  const usedImagePath = extractImages({ CardList, globalBackground }).map(img => img?.path && filePathToImageKey(img?.path));

  OverviewStorage.keys().filter(key => !usedImagePath.includes(key)).forEach(key => {
    delete OverviewStorage[key];
  });

  ImageStorage.keys().filter(key => !usedImagePath.includes(key)).forEach(key => {
    delete ImageStorage[key];
  });
}