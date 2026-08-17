const DISPLAY_FIELDS = ['name', 'description', 'texture', 'icon'];

/** Refresh theme-facing fields while preserving rolled and upgraded instance data. */
export function syncItemDisplayFields(item, itemsById) {
  if (!item) return item;
  const templateId = item.templateId || item.id;
  const master = itemsById?.[templateId];
  if (!master) return item;

  for (const field of DISPLAY_FIELDS) {
    if (master[field] !== undefined) item[field] = master[field];
  }
  return item;
}
