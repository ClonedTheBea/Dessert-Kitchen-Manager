# Sprint 2.1 implementation plan

Reference inspected: `../Apiary Dev Tools/repo/src/styles/global.css` and `tool-ui.css`. Extract the actual plum shell, pink accent, light cards, system typography, 44px controls, 8/11px radii and focus states into local semantic tokens. Keep the applications independent.

Checkpoint: `sprint-2-before-redesign`; verified SQLite backup `data/backups/before-sprint21-20261010-203826.db`. Baseline contains the owner's current 32 documents, 34 prices, 12 recipe versions, 7 stock lots and 7 movements. No reset or inventory migration is planned.

Navigation: Home (task shortcuts, stock attention and recent production); Recipes (recipe book, ingredients/packaging, suppliers/prices); Stock (ingredients/finished stock, purchases, production, counts, shopping, waste; history secondary); Money (four results first, then editable assumptions and advanced comparisons). Settings/backups remain secondary.

Workflow changes: combined ingredient and initial-price entry; compact editable purchase basket with known pack prefill; production essentials followed by optional adjustments; dedicated recipe reading page and sectioned editor; light readable forms; no decorative oversized recipe placeholders. Draft autosave and explicit publication/stock confirmation remain separate.

Verification: preserve existing backend and browser coverage, adapt navigation selectors, add combined-entry/retry tests and desktop/mobile redesign acceptance, inspect screenshots and contrast, run build/release, compare every baseline database row. Interaction estimates count task navigation and confirmations separately from data-entry gestures so the comparison remains reproducible. No Sprint 3 work.
