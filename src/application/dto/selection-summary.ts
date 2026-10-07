/** A selection as the web shows it: the menu and its Monday, `YYYY-MM-DD`. */
export type SelectionSummaryDto = { menuNumber: number; startsOn: string };

/** This week's menu and the menu of the current shopping list, each or `null` when not chosen. */
export type CurrentSelectionsDto = {
  activeMenu: SelectionSummaryDto | null;
  shoppingList: SelectionSummaryDto | null;
};
