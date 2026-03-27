const { eleActions} = require('../../shared/constants');
const {
  ImageStorage,
  OverviewStorage,
} = require('../services/store');
const { waitCondition, fixPath } = require('../../shared/functions');



//添加 basePath 参数，默认 '/api'
const registerImageAPI = (app, basePath = '/api') => {

  app.get(`${basePath}/${eleActions.getImageContent}`, async (req, res) => {
    try {
      const { path: imagePath, quality = 'low' } = req.query;
      const imagePathKey = fixPath(imagePath).replaceAll('\\', '');
      let content;
      if (quality === 'high') {
        content = ImageStorage[imagePathKey];
        if (!content) {
          try {
            await waitCondition(
              () => ImageStorage[imagePathKey],
              50,
              10000
            );
            content = ImageStorage[imagePathKey];
          } catch (error) {
            console.warn(`Timeout waiting for high quality image: ${imagePath}`);
            return res.status(404).send('Image not ready');
          }
        }
      } else {
        content = OverviewStorage[imagePathKey];
      }

      if (!content) {
        return res.status(404).send('Image not found');
      }

      const matches = content.match(/^data:image\/(\w+);base64,(.+)$/);

      if (!matches) {
        return res.status(500).send('Invalid image format');
      }

      const [, imageType, base64Data] = matches;
      const buffer = Buffer.from(base64Data, 'base64');

      //设置正确的 Content-Type
      const mimeTypes = {
        'jpeg': 'image/jpeg',
        'jpg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
      };

      const mimeType = mimeTypes[imageType.toLowerCase()] || 'image/jpeg';

      res.set('Content-Type', mimeType);
      res.set('Cache-Control', 'public, max-age=31536000'); // 缓存 1 年
      res.send(buffer);

    } catch (err) {
      console.error('Error getting image content:', err);
      res.status(500).send('Internal server error');
    }
  });
};

module.exports = { registerImageAPI };
