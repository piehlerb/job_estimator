# Job Actuals Inventory Update Design

## Goal

When a saved job's actual material quantities change, the job page should ask whether to update inventory. The user may save several incremental actuals changes without touching inventory. When the user chooses to update inventory, the app should show a review popup with the products affected, current inventory, net amount used from actuals, and editable new inventory values.

## Current Context

- `src/pages/JobForm.tsx` owns the job edit form and persists actual material fields in `handleSubmit`.
- Actual material values are saved only on form submit, not on every keystroke.
- Inventory is stored locally in IndexedDB through `src/lib/db.ts` and then queued for Supabase sync.
- Inventory stores are split by product group:
  - `chipInventory`: blend rows in pounds.
  - `tintInventory`: color rows in ounces.
  - `topCoatInventory`: single record with `topA` and `topB` gallons.
  - `baseCoatInventory`: single record with `baseA`, `baseBGrey`, `baseBTan`, and `baseBClear` gallons.
  - `miscInventory`: single record with `crackRepair`, `silicaSand`, and `shot`.
- Existing inventory commitment logic splits top coat 50/50 between Top A and Top B, and splits base coat into one-third Base A plus two-thirds of the selected Base B color.

## Decisions

- Use a job-level baseline: the last actual material quantities that were applied to inventory.
- Saving a job with changed actuals and choosing "No" saves the job only and leaves the baseline unchanged.
- Choosing "Yes" opens an editable inventory review popup.
- Applying the popup updates inventory and advances the baseline to the saved actual material quantities.
- Future updates apply only the delta between saved actuals and the baseline.
- Negative deltas are allowed and add inventory back.
- Missing inventory rows appear with current inventory `0` and are created when the popup is applied.
- The popup affects only the material inventory products confirmed by the user: chip blend, base coat parts, top coat parts, tint color, and crack repair.
- The separate `products` attached to jobs are out of scope for this feature.

## Data Model

Add an optional field to `Job`:

```ts
inventoryActualsApplied?: {
  actualBaseCoatGallons?: number;
  actualTopCoatGallons?: number;
  actualCyclo1Gallons?: number;
  actualTintOz?: number;
  actualChipBoxes?: number;
  actualCrackRepairOz?: number;
  chipBlend?: string;
  baseColor?: string;
  tintColor?: string;
  appliedAt: string;
};
```

The material quantities in this field represent the baseline already reflected in inventory. The material identity fields are included because changing chip blend, base color, or tint color after an inventory update must reverse the old material identity and apply the new one.

## Inventory Delta Mapping

Build rows from the difference between the current saved actuals and `inventoryActualsApplied`.

- Chips: `actualChipBoxes * 40` pounds against the normalized chip blend inventory row.
- Base coat: `actualBaseCoatGallons / 3` gallons against Base A, plus `(actualBaseCoatGallons * 2) / 3` gallons against Base B for `Grey`, `Tan`, or `Clear`.
- Top coat: `actualTopCoatGallons / 2` gallons against Top A and `actualTopCoatGallons / 2` gallons against Top B.
- Tint: `actualTintOz` ounces against the selected tint color when tint is enabled and a tint color exists.
- Crack repair: `actualCrackRepairOz / 128` gallons against misc inventory Crack Repair.
- Cyclo1 is not updated because there is no Cyclo1 inventory store today.

If a material identity changed since the last inventory update, compute two sets of deltas:

- Reverse the baseline quantity from the old identity.
- Apply the current saved quantity to the current identity.

The popup should aggregate these into readable rows by inventory product. A negative "used from actuals" value means inventory will increase.

## Save Flow

1. User edits actual material quantities and submits the job form.
2. The form validates and saves the job.
3. If actual material quantities or material identities differ from the inventory baseline, ask whether to update inventory.
4. If the user chooses "No", return to the previous page after saving the job.
5. If the user chooses "Yes", keep the user on the job page and open the review popup.
6. The popup loads current inventory, builds delta rows, and pre-fills each new inventory value as `current - delta`.
7. User can edit each new inventory value.
8. Applying updates writes only the rows shown, saves the updated baseline on the job, and then returns to the previous page.
9. Cancel closes the popup and returns to the previous page without inventory changes.

## Popup UI

The review popup should show a compact table with:

- Product name.
- Current inventory value.
- Amount used from actuals.
- Editable new inventory value.

Rows should include units so values are unambiguous: pounds, gallons, or ounces. New inventory inputs should accept decimal values. If a row would have a zero delta, omit it from the popup.

## Error Handling

- If inventory loading fails after the job save, show an error and leave inventory plus the applied-baseline field unchanged.
- If applying inventory fails, leave the baseline unchanged and keep the popup open with an error message.
- If no rows are produced, skip the popup and treat inventory as up to date.
- If a base color is not `Grey`, `Tan`, or `Clear`, update Base A only and show an inline warning that no matching Base B inventory bucket exists.

## Sync And Persistence

Use the existing `save*Inventory` helpers so each changed inventory store is queued for sync. Updating the job baseline should use `updateJob`, which also queues the job for sync. No new Supabase table is required; the new job field should be carried by existing local job persistence and sync serialization.

## Testing

Add tests around a pure delta-building helper:

- First inventory update subtracts full current actuals from zero baseline.
- Saving with "No" leaves the baseline unchanged, so a later "Yes" applies the accumulated delta.
- Later actual increases subtract only the increase.
- Later actual decreases add inventory back.
- Changed chip blend, base color, or tint color reverses the old identity and applies the new identity.
- Missing inventory rows default current inventory to `0`.

Run TypeScript typecheck and build after implementation. Browser verification should cover the save prompt and review popup in the actual job form.
