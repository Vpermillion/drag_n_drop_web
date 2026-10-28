# Workspace Studio

The builder uses an original Roblox Studio-inspired workspace: a dark insertion ribbon, folder Explorer, central page viewport and properties panel. Website content keeps its own theme; the Studio theme affects editing controls only.

## Build and organize

- Insert any primitive from the top ribbon, including containers, buttons, text, forms and isolated HTML/JS widgets. The Toolbox also has draggable elements and a shortcut to the existing Creative Studio starters.
- Choose **Above / Дээр**, **Inside / Дотор**, or **Below / Доор** before inserting. Inside a leaf inserts its next sibling. The page root can only accept children.
- Containers, forms, collections and conditionals appear as expandable folders. They are actual rendered containers, not filesystem folders. Collapsing a folder only changes the Explorer view.
- Drag the Explorer grip onto the labeled **Above**, **Inside**, or **Below** zone. Canvas drop indicators also support insertion above/below a node; dropping onto a container nests the element.
- **Folder** wraps the selected element in a container at its current sibling position. Existing record bindings and actions remain attached. **Move out** lifts an element one level. Reorder, duplicate and delete commands are available in the ribbon.
- Rename with the ribbon, a double-click, **F2**, or the properties Name field. Names support Mongolian and other Unicode text up to 100 characters. New elements and copies receive distinct names; stable internal IDs remain unchanged.
- Search the Explorer by name. Arrow keys navigate, left/right collapse or open folders, Home/End select the first/last visible element. Ctrl/Command G groups, D duplicates, Z undoes, Shift Z redoes, and S saves. Typing fields keep their normal text shortcuts.

## Place elements

**Flow / Дараалал** uses the parent layout: vertical/horizontal flex, grid and spacing. Use it for responsive document sections.

**Free / Чөлөөтэй** positions an element inside its nearest parent container. Choose one of nine anchors, enter X/Y offsets, and drag the **✥** handle attached to the canvas selection. Negative offsets and offsets up to 4096 px are supported. Set the layer order from 0 to 10. Parent containers need enough height to hold free-position children because absolute elements do not add flow height. The root stays in flow.

The phone/desktop buttons edit the respective style settings. Mobile settings inherit desktop values until overridden; choose a mobile anchor explicitly if it should remain independent of later desktop anchor changes. The renderer applies the same anchor geometry to public pages and the selectable editing wrappers. At narrow screens the ribbon scrolls horizontally, Explorer is above the viewport, and properties are below it.

All changes use the existing undo/redo, draft save, validation, preview and immutable publication paths. The GitHub Pages variant still persists only in the current browser. The Node variant still saves through the authenticated API. Tailwind, scoped CSS, effects, business bindings and sandboxed widgets remain available through Creative Studio.

## Verification

`npm test` covers relative insertion/reordering, immutable changes, cycle/root rejection, distinct names, preserved record scope/actions after grouping and anchored renderer output. `npm run test:workspace` exercises both production Node and static Pages builds with real pointer movement, nested folder drag targets, insert order, grouping, search, rename, keyboard navigation, history, persistence, desktop/mobile published coordinates, overflow and WCAG A/AA scans. Build both variants before running it. Screenshots and diagnostics go to ignored `artifacts/`.
