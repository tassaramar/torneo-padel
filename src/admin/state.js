export const state = {
  groups: {}
};

export function isEditable(groupId) {
  const g = state.groups[groupId];
  return !!g && (g.editableBase || g.unlocked);
}
