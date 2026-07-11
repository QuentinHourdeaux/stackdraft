const descriptionPreviewMaxLength = 140;

/** Collapses whitespace and truncates long descriptions for list previews. */
export const formatDescriptionPreview = (
  description: string,
): string | null => {
  const trimmed = description.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const plainText = trimmed.replace(/\s+/g, " ");

  if (plainText.length <= descriptionPreviewMaxLength) {
    return plainText;
  }

  return `${plainText.slice(0, descriptionPreviewMaxLength - 1)}…`;
};
