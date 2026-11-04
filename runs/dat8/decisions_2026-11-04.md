# DAT-8 decisions (Nov 4, 2026)

These are the admin's final decisions, which supersede the earlier pastes. `dat8_apply.sql` covers exactly these rows. The admin runs it; nothing has been run.

## Applied by dat8_apply.sql
| Rows | What |
| --- | --- |
| T1-T80 | ticker, CIK, `markets = ['US']`, exchange, from the SEC list |
| X3 | Didi: DIDIY, OTC, CIK 1764757; type becomes public_company; markets empty |
| X4-X16 | HKEX `NNNN.HK`, `markets = ['HKEX']` |
| X19, X21, X22 | LSE `BA.L`, `ZEG.L`, `MNG.L`, `markets = ['LSE']` |
| X1, X24-X32, X44-X51, X60-X62 | confirmed on the exchange's own site on Nov 4 (source in each SQL comment); suffixed ticker; markets empty |
| A1-A3 | aliases TSMC, Facebook, Meta |
| D1, D2, D5-D9, D11 | merge; links 667, 671 and 672 get a "via" note; link 672's ends swap, because 'competes' needs source_id < target_id |
| D10 | 367 and 368 merge into 370 with all their links; no link is rejected (486 stays promoted). The two empty team nodes are then deleted like every other merge. |
| D12 | merge 318 into 337; link 442 rejected, 426 kept |
| D3 | node 386 (BT, 0 links) deleted; 422 kept |
| F1 | link 704 source NEC -> Lenovo |
| N1-N6, N8-N12 | type becomes private_company, no ticker (N13-N15 are merged in D1, D2 and D9) |
| C1-C3 | kept as groups: links 34, 35 and 36 stay promoted; no change |

Suffixes used: `.HK`, `.L`, `.DE` (Xetra), `.AS` (Euronext Amsterdam), `.PA` (Euronext Paris), `.SW` (SIX), `.OL` (Oslo), `.ST` (Stockholm), `.TW` (TWSE), `.TWO` (TPEx), `.JK` (IDX), `.AX` (ASX), `.NR` (Nairobi).
- `.NR` is my choice: I know of no common suffix for Nairobi.
- Volvo's exchange code "VOLV B" contains a space, so it's stored as `VOLV-B.ST` to keep the company URL working.
- Existing tickers (`0992` Lenovo, `AML`, `VOD`) are unchanged and have no suffix.

## Not applied
| Row | Why |
| --- | --- |
| D13 | **Held.** Link 462's quote: Vodafone will get "a 10% shareholding in a soon-to-be-formed Benelux entity ('Ziggo Group'), which will own 100% of both VodafoneZiggo and … Telenet". Link 423 is Vodafone's current 50% of VodafoneZiggo. So they are different facts, and Ziggo Group (371) is a different, new company that will own VodafoneZiggo (320). Merging would make 462 say Vodafone holds 10% of VodafoneZiggo, which is false. My review table had this wrong. Also, 462 is an agreed future stake, not a current holding. |
| X54 | Link 673's quote names only "Mango TV", so there's no rename (admin's condition) and no ticker. |
| X2 Samsung, X43 HD Hyundai | Korea Exchange: not tried. Samsung's own IR listing page returned 404 earlier. |
| X17 SANY, X55 Yutong, X56 SAIC | Shanghai SE: the company page loads without data. |
| X18 CATL, X52 Tongfu, X53 NavInfo | Shenzhen SE: not tried. |
| X34-X41 (8 Tokyo codes) | JPX quote site returns 401; the listed-company search needs a form submission, which I did not make. |
| X58 ComfortDelGro, X59 Singtel | SGX: "Page has been moved". |
| X63 HTA | ASX: 404 for HTA. |
| X64 Indus Towers, X65 Vodafone Idea | NSE India: quote page shows no data. |
| X66 Coronation | JSE: no company page reached. |
| X67 e& | ADX: profile page redirects to the home page. |
| X20, X23, X33, X42, X57, N7, N16-N19 | Drop, as decided. |
