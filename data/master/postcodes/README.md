# รหัสไปรษณีย์ (แยกภาค)

The list the logistic sign-up forms pick from: ภาค → จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์.

Source: KYN's Google Sheet "รหัสไปรษณีย์ (แยกภาค)" (doc tab "Logistic", 18 Oct 2026), one tab per region plus a
tab with every row. `postcodes-th.csv` is the six region tabs joined, with the tab name as the first column
(ภาค); the other columns are the sheet's as they are: จังหวัด, อำเภอ/เขต, ตำบล/แขวง, รหัสไปรษณีย์, รหัสจังหวัด,
รหัสอำเภอ, รหัสตำบล (7,432 rows, 77 provinces, 928 districts).

`node scripts/gen-places.mjs` builds `src/lib/places-data.json` from it. The sheet has no coordinates: for the
map picker each ตำบล gets the centre of the same ตำบล in `data/master/tambon` (CC BY 4.0), else its district's,
else its province seat's. The distance to a recipient address still uses `data/master/tambon`.

When KYN updates the sheet: export the six region tabs again, rebuild `postcodes-th.csv` the same way, and run
the script.
