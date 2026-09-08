# Bromine themes

Modular CSS. Each look is one token file; layout lives in `chrome.css`.

```
theme/
  tokens/midnight.css   # :root[bromine-theme="midnight"] { --bromine-* }
  tokens/nord.css
  tokens/mocha.css
  tokens/paper.css
  chrome.css            # tabs, urlbar, sidebar using tokens
  BromineTheme.sys.mjs    # sets attribute + registers chrome.css
  addons/bromine-*/       # optional lightweight theme color maps
```

Installed into the Firefox tree by `scripts/install-bromine-theme.py` during `make dir`.
