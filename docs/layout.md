# Programmable / draggable layout

Bars: `tabs`, `nav`, `bookmarks`, `rail`  
Edges: `top`, `bottom`, `left`, `right`, `hidden`

## Drag UI

1. Settings → Bromine → **Layout** → *Edit layout*, or press **Ctrl+Shift+E**
2. Drag the **⠿** grip on a bar onto Top / Bottom / Left / Right / Hide
3. Press **Ctrl+Shift+E** again to exit

Notes:
- Tabs → **left/right** turns on Firefox vertical tabs
- Tabs / nav / bookmarks → **bottom** docks under the page
- Rail → **left/right/hidden**

## Programmable (about:config)

`bromine.layout.bars` (string, JSON):

```json
{"tabs":"bottom","nav":"top","bookmarks":"top","rail":"right"}
```

`bromine.layout.editMode` (bool)

From the Browser Console (chrome):

```js
const { BromineLayout } = ChromeUtils.importESModule(
  "resource:///modules/BromineLayout.sys.mjs"
);
BromineLayout.setBar("tabs", "bottom");
BromineLayout.setLayout({ rail: "right", bookmarks: "top" });
BromineLayout.toggleEditMode();
```
