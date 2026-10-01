/**
 * PoseImage - A pose's bundled photo, or a themed icon placeholder when the
 * pose has no photo (see data/poseImages.js).
 */
import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/theme';
import { getPoseIcon } from '../data/poseImages';

const PoseImage = ({ poseId, image, style, iconSize = 48, resizeMode = 'cover' }) => {
  if (image) {
    return <Image source={image} style={style} resizeMode={resizeMode} />;
  }
  const icon = getPoseIcon(poseId);
  const Icon = icon.family === 'ion' ? Ionicons : MaterialCommunityIcons;
  return (
    <View style={[style, styles.placeholder]}>
      <Icon name={icon.name} size={iconSize} color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PoseImage;
