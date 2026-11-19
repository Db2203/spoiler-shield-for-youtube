# Manual testing on real YouTube

The automated tests only ever see local mock pages. This checklist verifies the extension against the real site without exposing you to anything: it uses the harmless keyword **pizza**, which is common enough on YouTube to show up everywhere.

Report results as "hidden" or "not hidden" per step. If something leaks, note the page and the kind of item (tile, Short, comment, suggestion), not its content.

## Setup

1. Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose `extension/manifest.json`.
2. Click the extension's toolbar icon. In the popup, add `pizza` on its own line under **Strong keywords**. Leave the GTA keywords in place.
3. If the popup shows an "Allow on youtube.com" button, click it. Firefox normally grants access on install; if it was revoked, the button restores it. You can also do this from the Extensions toolbar button: open the extension's menu and choose **Always Allow on youtube.com**.
4. Reload any YouTube tab that was already open.

## Checklist

| # | Where | Do | Expect |
|---|-------|----|--------|
| 1 | Home | Scroll until a few pizza videos would normally appear | No tile mentioning pizza; grid has no gaps |
| 2 | Home | Keep scrolling for a while (infinite scroll) | New pizza tiles never flash into view |
| 3 | Home, Shorts shelf | Look at the Shorts row | No pizza Short |
| 4 | Search | Type `piz` in the search box, pause | Suggestions containing "pizza" are missing from the dropdown |
| 5 | Search | Search for `pizza` | Results list is empty or contains only non-pizza items (e.g. channels whose name does not mention it) |
| 6 | Search | Search for `pasta` | Non-pizza results show; any result mentioning pizza in its description is hidden |
| 7 | Watch | Open any cooking video | Sidebar has no pizza recommendations; hovering a sidebar thumbnail never starts a preview |
| 8 | Watch | Scroll to comments on a popular cooking video | Comments mentioning pizza are hidden |
| 9 | Watch | Open a video whose title contains pizza (use a direct link if search is empty) | Dark "Spoiler blocked" screen, no audio, **Go back** returns to the previous page |
| 10 | Watch | Open a safe video, then click a sidebar video (in-page navigation) | No flash of the next video's title or player before the check completes |
| 11 | Watch | Let a safe video end | End screen cards and the end video wall contain no pizza items |
| 12 | Shorts | Open `youtube.com/shorts` and swipe through a few | A pizza Short is covered immediately and its audio stops |
| 13 | Channel | Add `@<some pizza channel handle>` under **Blocked channels** and open that channel | Page is covered with "This channel is on your blocklist" |
| 14 | Channel | Open a cooking channel's **Videos** tab | Pizza videos missing from the grid |
| 15 | Community | Open a channel's **Community** tab | Posts mentioning pizza hidden |
| 16 | Notifications | Open the bell menu | Notifications mentioning pizza hidden |
| 17 | Popup | Turn **Blur all thumbnails** on | Every thumbnail blurred with "Click to reveal"; one click reveals one tile, second click opens it |
| 18 | Popup | Turn **Strict mode** on | Clicking a blurred thumbnail opens the video without revealing; blocked pages have no "Show anyway" |
| 19 | Popup | Flip the main switch off | Everything reappears without reloading; switch on hides again |
| 20 | Popup | Check the counters | "Hidden on this page" matches roughly what you scrolled past; total keeps growing across pages |

## If something is not hidden

Every YouTube selector lives in `extension/content/selectors.js`, and the fail-closed list in `extension/content/hide.css` must match it. Open the browser console on the page (F12) and look for lines starting with `[SpoilerBlocker]`. Then run `npm test` after a fix to make sure the mock pages still pass.
