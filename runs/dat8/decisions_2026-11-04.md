# DAT-8 decisions (Nov 4, 2026)

The admin's Keep/Fix/Drop for each row came as a pasted review. Part 1 SQL (`dat8_apply_part1.sql`) covers exactly the approved rows that are verified. The admin runs it; nothing has been run.
That paste's T27-T29 company ids are off by one (it gives Sony as 177; 177 is Texas Instruments). The SQL uses the ids from the review table, matched by row ID.

## In part 1
| Rows | What |
| --- | --- |
| T1-T80 | ticker, CIK, `markets = ['US']`, exchange (SEC list) |
| X1 | Delivery Hero DHER, Xetra (Deutsche Börse page) |
| X3 | Didi DIDIY, OTC, CIK 1764757 (SEC list); type to public_company; markets empty |
| A1-A3 | aliases TSMC, Facebook, Meta |
| D1, D2, D5-D13 | merges; links 667, 671 and 672 get a "via" note; link 672's ends swap (competes needs source_id < target_id) |
| D10 | link 486 rejected as a duplicate of 488 ("clear out the historical sponsor artifacts") |
| D12 | link 426 rejected (same deal as 442) |
| F1 | link 704 source NEC -> Lenovo |
| N1-N6, N8-N12, N16-N18 | entity_type to private_company (N13-N15 merged in D) |
| D3, D4, D14, N19, X33 | no change, as decided |

## Held: needs the admin
| Row | Why held |
| --- | --- |
| C1-C3 | The paste says reject the links and remove the nodes. The admin's own message earlier the same day says keep them as groups, so they stay. |
| D13, link 462 | The paste says reject 462. Its note from an earlier review reads "re-pointed from Liberty Global to Ziggo Group; 10% stake per quote", so it may be the 10% stake rather than a duplicate of 423. The merge is in part 1; the rejection is not. |
| X23 Mercedes | Renaming to Mercedes-Benz Group conflicts with the quotes: links 476, 478 and 483 name "Mercedes-Benz AG" / "MBAG" (the subsidiary) as the shareholder and partner. Leaving it without a ticker stays true. |
| X42 Hyundai | Both quotes (122, 587) say only "Hyundai"; nothing says Hyundai Motor Company. |
| X57 OmniVision | The SEC list names the listed parent "OmniVision Integrated Circuits Group, Inc.", not "Will Semiconductor". Link 261 is about OmniVision Technologies Inc. (2003). |
| N7 Allscripts / MDRX | MDRX is not in the SEC list, and Expert Market quotes are not public, so it can't be checked on an exchange. |
| X2, X4-X67 (except X23, X33, X42, X57) | Approved, but each code still has to be checked on the exchange's own site (part 2). |

Confirmed from the quotes: X2 is Samsung Electronics (link 137: "Samsung Electronics Co., Ltd."); X32 is AB Volvo (link 83: "Level 4 Class 8 trucks").
