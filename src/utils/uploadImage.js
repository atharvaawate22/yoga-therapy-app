/**
 * Shrink a photo before sending it to the pose API.
 *
 * Camera and gallery photos arrive at full sensor resolution (12MP+), and
 * `quality` only changes JPEG compression, not pixel count. MoveNet works on a
 * 192px input anyway, so uploading megapixels just costs mobile data and
 * latency, and risks the Lambda 6 MB payload limit.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 960;

/** Returns base64 JPEG data with the longest side capped at MAX_SIDE. */
export const prepareImageForUpload = async (uri, width, height) => {
  const context = ImageManipulator.manipulate(uri);
  let image;
  try {
    if (width && height && Math.max(width, height) > MAX_SIDE) {
      context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    image = await context.renderAsync();
    const result = await image.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });
    return result.base64;
  } finally {
    image?.release();
    context.release();
  }
};
