// "Show more" button for paged lists.
import { act } from "../actions.js";

export const moreButton = (show: boolean, action: string) =>
  show ? `<button class="btn" ${act(action)}>Show more</button>` : "";
