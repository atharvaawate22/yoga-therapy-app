/**
 * Shared utility to safely resolve a pose image source for React Native <Image>
 * Handles: number (local require), {uri: string} (remote), or string (direct uri)
 */
export const resolveImageSource = (image) => {
  if (!image) {
    return { uri: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop' };
  }
  // Local require() returns a number
  if (typeof image === 'number') return image;
  // Already a {uri} object
  if (typeof image === 'object' && image.uri) return image;
  // Plain string URL
  if (typeof image === 'string') return { uri: image };
  return { uri: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop' };
};
