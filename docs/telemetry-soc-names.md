# Telemetry SoC names

The telemetry service normalizes verified public names so equivalent spellings appear together in aggregates, filter options and record drilldowns. A public name is not a claim about a device's clock rate, silicon bin, CPU configuration, runtime compatibility or expected performance. Sources below were checked on 2026-09-16.

## Normalization rules

- Keep the reported identifier and meaningful suffixes. Match an explicit allowlist; do not infer a model by numeric prefix, remove `+` or `s`, or discard package suffixes such as `-AC` and `-AF`.
- A chip-vendor document can establish a public name. A software platform code or shared Android kernel directory alone cannot establish a unique retail model. When joining OEM device specifications to device source, require the same model and record that inference.
- Expand a complete, unambiguous public-name shorthand such as `8gen1` to `Snapdragon 8 Gen 1`. Preserve `8+gen1`, `8sgen3` and `8gen3` as different names. A partial string such as `778` is insufficient to choose `778G` or `778G+`.
- Preserve unknown or ambiguous identifiers internally. Add an exact device constraint when a platform has several known public models; do not promote that device-specific result to a global alias.

The shared registry is [`packages/contracts/src/telemetry-soc.ts`](../packages/contracts/src/telemetry-soc.ts), consumed by [`backend/src/telemetry/telemetry.service.ts`](../backend/src/telemetry/telemetry.service.ts) and the frontend. `resolveKnownSocName` feeds device normalization and SoC filter-key normalization. This shared path affects aggregation, filter candidates and record drilldowns; a mapping change must be checked on all three. New ingest retains the client-reported SoC identifier after ordinary string cleanup instead of replacing it with the inferred public name. Historical database rows are not rewritten. Read-time normalization cannot recover a suffix or identity already discarded by an older client or stored row.

## Public consumer labels

The public performance matrix, filters, reports and record details display consumer chip names. Identified chips use their consumer names. Unidentified chips display their complete internal identifier followed by “（型号待识别）”, including every supplied revision or package suffix, consistently in filters, matrix titles, reports, tooltips and record details. Only missing identifiers use “芯片型号待识别”. Do not guess a retail variant to avoid that label.

The frontend consumer formatter is separate from statistical identity. Equal public labels form one filter option covering all corresponding identities; different unresolved identifiers have separate options. Matrix rows and record queries retain their original keys; a public family or unknown label never combines their measurements. Legacy filter selections resolve through their original canonical/reported identities before migrating to public groups. Older vendor-wide unidentified groups expand into the current unidentified chip options for that vendor, excluding chips that have since been identified. Original identifiers remain searchable.

Snapdragon X CPU implementation strings are shown by their reported retail family; Dragonwing and Adreno also use public family names. These display labels do not assert an exact SKU. Desktop CPU/GPU labels omit trademark boilerplate, PCI implementation codes and revision strings. Raw ingest and historical rows remain unchanged.

## Verified public-name mappings

These inputs support the named public model in the bounded source audit. They are exact lookup entries, not permission to match every longer identifier beginning with the same code. A product brief may list a fuller package identifier than the observed base code; retain any supplied fuller identifier and do not infer its clock/bin from this table.

| Input | Public name | Primary source |
| --- | --- | --- |
| `SM4375` | Snapdragon 4 Gen 1 | [Qualcomm product documentation](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-4-Gen-1-Product-Brief.pdf) |
| `SM6475` | Snapdragon 6 Gen 3 | [Qualcomm product documentation (SM6475-AB)](https://docs.qualcomm.com/doc/87-82624-1/87-82624-1_REV_A_Snapdragon_6_Gen_3_Mobile_Platform_Product_Brief.pdf) |
| `SDM710` | Snapdragon 710 | [Qualcomm product documentation](https://www.qualcomm.com/smartphones/products/7-series) |
| `SM7550` | Snapdragon 7 Gen 3 | [Qualcomm product documentation (SM7550-AB)](https://docs.qualcomm.com/bundle/publicresource/87-64372-1_REV_B_Snapdragon_7_Gen_3_Mobile_Platform_Product_Brief.pdf) |
| `SM6450` | Snapdragon 6 Gen 1 | [Qualcomm product documentation](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/product_brief_snapdragon_6_gen_1.pdf) |
| `SM7475` | Snapdragon 7+ Gen 2 | [Qualcomm product documentation (SM7475-AB)](https://docs.qualcomm.com/doc/87-43682-1/87-43682-1_REV_B_Snapdragon_7__Gen_2_Mobile_Platform_Product_Brief.pdf) |
| `SM7125` | Snapdragon 720G | [Qualcomm product documentation](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/qualcomm_snapdragon_720g_mobile_platform_product_brief_0.pdf) |
| `SM7750` | Snapdragon 7 Gen 4 | [Qualcomm product documentation (SM7750-AB)](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-7-Gen-4-Mobile-Platform-Product-Brief.pdf) |
| `SM4250` | Snapdragon 460 | [Qualcomm product documentation (SM4250-AA)](https://www.qualcomm.com/media/documents/files/qualcomm-snapdragon-460-mobile-platform-product-brief.pdf) |
| `SM8650` | Snapdragon 8 Gen 3 | [Qualcomm product documentation (SM8650-AA, SM8650-AB, SM8650-AC)](https://docs.qualcomm.com/bundle/publicresource/87-71408-1_REV_G_Snapdragon_8_gen_3_Mobile_Platform_Product_Brief.pdf) |
| `SM4635` | Snapdragon 4s Gen 2 | [Qualcomm product documentation](https://docs.qualcomm.com/doc/87-78935-1/87-78935-1_REV_B_Snapdragon_4s_Gen_2_Mobile_Platform_Product_Brief____.pdf) |
| `SM7675` | Snapdragon 7+ Gen 3 | [Qualcomm product documentation (SM7675-AB)](https://docs.qualcomm.com/doc/87-73943-1/87-73943-1_REV_C_Snapdragon_7__Gen_3_Mobile_Platform_Product_Brief.pdf) |
| `SDM845` | Snapdragon 845 | [Qualcomm product documentation](https://www.qualcomm.com/processors/application-processors/products/sdm845) |
| `SM7450` | Snapdragon 7 Gen 1 | [Qualcomm product documentation (SM7450-0-AB, SM7450-1-AB)](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-7-Gen-1-Product-Brief.pdf) |
| `SM7435` | Snapdragon 7s Gen 2 | [Qualcomm product documentation (SM7435-AB)](https://docs.qualcomm.com/doc/87-64361-1/87-64361-1_REV_B_Snapdragon_7s_Gen_2_Mobile_Platform_Product_Brief.pdf) |
| `SM7225` | Snapdragon 750G 5G | [Qualcomm product documentation](https://www.qualcomm.com/media/documents/files/snapdragon-750g-5g-mobile-platform-product-brief.pdf) |
| `QCM6490` | Qualcomm Dragonwing QCM6490 | [Qualcomm product documentation](https://www.qualcomm.com/internet-of-things/products/q6-series/qcm6490) |
| `MT6873` | MediaTek Dimensity 800 | [Ulefone Armor 10 specifications](https://store.ulefone.com/pages/armor-10-specs) name both identifiers. |
| `MT6781` | MediaTek Helio G96 | Same-device join: [Xiaomi Redmi Note 11S FAQ](https://www.mi.com/sg/support/faq/details/KA-07867/) identifies MT6781; [official specifications](https://www.mi.com/global/product/redmi-note-11s/specs/) identify G96. |

Complete Snapdragon marketing shorthands follow the manufacturer's spelling; they are local text-normalization inputs, not official part numbers. Examples are [8 Gen 1](https://www.qualcomm.com/smartphones/products/8-series/snapdragon-8-gen-1-mobile-platform), [8+ Gen 1](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-8-plus-Gen-1-Product-Brief.pdf), [8s Gen 3](https://www.qualcomm.com/smartphones/products/8-series/snapdragon-8s-gen-3-mobile-platform) and [8 Elite](https://www.qualcomm.com/smartphones/products/8-series/snapdragon-8-elite-mobile-platform). Keep their generation, `s`, `+` and `Elite` distinctions.

## Mappings that require a device identity

| Reported code and exact device | Public name | Primary source |
| --- | --- | --- |
| `MT6779` + `BV8900` | MediaTek Helio P90 | [Blackview BV8900 specifications](https://www.blackview.hk/products/item/bv8900). |
| `MT6983` + `CPH2493` | MediaTek Dimensity 9000 | [OnePlus compliance list](https://www.oneplus.com/uk/pstisoc) identifies CPH2493 as Nord 3; [Nord 3 specifications](https://www.oneplus.in/nord-3-5g) identify Dimensity 9000. This is an explicit same-device join. |

Neither rule assigns every MT6779 or MT6983 report to that model. MT6771 also remains unresolved without an independently verified device identity: [Blackview A90 specifications](https://store.blackview.hk/nl/products/blackview-a90-4g-smartphone) identify P60/MT6771, while the [Realme 3 Android device source](https://github.com/N00bTree/android_device_realme_RMX1821) identifies P70 and its [BoardConfig](https://github.com/N00bTree/android_device_realme_RMX1821/blob/twrp-9.0/BoardConfig.mk) uses `mt6771`.

## Withdrawn unconditional aliases

The following platform-to-single-model aliases must remain removed. The examples establish ambiguity; they do not claim that all members share identical hardware or performance.

| Bare platform | Do not automatically assign | Evidence of ambiguity |
| --- | --- | --- |
| `MT6765` | Helio P35 | [Original postmarketOS platform documentation](https://wiki.postmarketos.org/wiki/MediaTek_Helio_P35_%28MT6765%29) distinguishes P35, G35 (`MT6765G`) and G37 (`MT6765H`). A bare software-platform report can omit those discriminators. |
| `MT6853` | Dimensity 720 | [Redmi Note 9T device BoardConfig](https://raw.githubusercontent.com/xiaomi-mt6853-devs/android_device_xiaomi_cannon/lineage-20/BoardConfig.mk) uses `mt6853`; [Xiaomi specifications](https://www.mi.com/uk/product/redmi-note-9t/specs/) identify 800U. |
| `MT6879` | Dimensity 1050 | [Edge 40 Neo device source](https://github.com/Matheus-TestUser1/android_device_motorola_manaus) identifies MT6879/7030; [Motorola specifications](https://www.motorola.com/gb/en/p/phones/motorola-edge/40-neo/pmipmge35mt) identify 7030. |
| `MT6878` | Dimensity 7300 | Nothing's MT6878 source contains [CMF Phone 1](https://github.com/NothingOSS/android_kernel_device_modules_6.1_nothing_mt6878/blob/957dac185efe46cbf6336b0fff9516d84c8cd78f/README.md) and [Phone 2 Pro](https://github.com/NothingOSS/android_kernel_device_modules_6.1_nothing_mt6878/blob/6f54bed150483c2862d71dbf3d39dee3a17f0816/README.md); their [7300](https://in.nothing.tech/products/cmf-phone-1) and [7300 Pro](https://intl.nothing.tech/products/cmf-phone-2-pro) specifications differ. |
| `SM8150` | Snapdragon 855 | [Qualcomm 855+/860 brief](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/product_brief_-_qualcomm_snapdragon_855_860.pdf) gives both 855+ and 860 the full identifier `SM8150-AC`; even that full identifier is not unique between those names. |
| `SM8250` | Snapdragon 865 | [Qualcomm bulletin](https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin) identifies 865+ as `SM8250-AB`; [870 brief](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/prod_brief_qcom_sd870_5g.pdf) identifies `SM8250-AC`. |
| `SM7635` | Snapdragon 7s Gen 3 | Qualcomm documents [7s Gen 3](https://docs.qualcomm.com/doc/87-78936-1/87-78936-1_REV_A_Snapdragon_7s_Gen_3_Mobile_Platform_Product_Brief.pdf) and [7s Gen 4](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-7s-Gen-4-product-brief.pdf) as base and `-AC` variants. |

Other ambiguous bare Qualcomm platforms include `SM6225`, `SM6375`, `SM7150`, `SM7250`, `SM4350`, `SM4450`, `SM7325` and `SM6150`. For example, [685](https://docs.qualcomm.com/bundle/publicresource/87-43683-1_REV_A_SNAPDRAGON_685_4G_MOBILE_PLATFORM_PRODUCT_BRIEF.pdf) uses SM6225-AD and [6s 4G Gen 2](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/snadragon-6s-4g-gen-2-product-brief.pdf) uses SM6225-AF. Keep the suffix; do not turn either into a bare-code 680 mapping. `SM8953` and incomplete marketing names remain distinct internal identities until their exact mapping is independently established. `SDM670` is verified as Snapdragon 670 by [Google’s published processor table](https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp4156.pdf), page 6.

Other MediaTek codes remain explicit when source evidence does not uniquely determine a public name. MediaTek's [developer performance table](https://developer.mediatek.com/ai/64254ccbf55b040d6989a99a.html) directly groups 1100/1200 under MT6893 and 8000/8100 under MT6895. Ulefone pairs MT6789 with both [G99](https://store.ulefone.com/pages/power-armor-19t-specs) and [G100](https://store.ulefone.com/pages/armor-30-specs). These are positive counterexamples, not missing display aliases. [MT8788](https://www.mediatek.com/iot/modem-based-iot/mt8788) is itself an official MediaTek product name; the [MT8755 certification](https://opendevelopment.verizonwireless.com/design-and-build/approved-chipsets/chipset/27296) describes a tablet variant, not an exact phone-model alias. Shared architecture, rebranding or a reusable device tree is insufficient for a new aggregation alias.

## Google Pixel fallback

For a generic Tensor/SoC report, use an exact recognized Pixel model according to [Google's hardware specifications](https://support.google.com/pixelphone/answer/7158570?hl=en). Do not infer a generation by a numeric prefix or replace an explicit conflicting chip identity.

| Recognized phone model | Public SoC name |
| --- | --- |
| Pixel 6, 6 Pro, 6a | Google Tensor |
| Pixel 7, 7 Pro, 7a | Google Tensor G2 |
| Pixel 8, 8 Pro, 8a | Google Tensor G3 |
| Pixel 9, 9 Pro, 9 Pro XL, 9a | Google Tensor G4 |
| Pixel 10, 10 Pro, 10 Pro XL | Google Tensor G5 |
| Pixel 10a | Google Tensor G4 |

Pixel 10a is an explicit exception to the other Pixel 10 models. Unknown or newer names and unlisted Fold or Tablet models require their own verified exact entry; a partial `Pixel 1`/`Pixel 10` match must not classify a different model.

## Verification when changing a mapping

Update the focused checks in [`tools/check-telemetry.cjs`](../tools/check-telemetry.cjs) for equivalent names, unresolved/suffixed counterexamples, device constraints, unchanged stored history and raw ingest identity. Run `pnpm check:telemetry`, then verify that the selected SoC's displayed aggregate and record drilldown agree. SoC name normalization must not change model, quantization, backend, build-mode or other independent aggregation dimensions.

## Additional exact device rules

Each row requires both the reported platform and the exact device model. Sources are OEM specifications and, where needed, OEM manuals linking model identifiers. These rules do not apply to unlisted devices on the same platform.

| Reported platform | Exact device model | Consumer chip | OEM evidence |
| --- | --- | --- | --- |
| `MT6789` | `22071219CG` | MediaTek Helio G99 | [Source 1](https://www.po.co/global/product/poco-m5/), [Source 2](https://ams-go.buy.mi.com/it/servicecenter/file/POCO_M5_Safety_Information_it/?binaryId=221160&namespaceId=2&publicationId=221166) |
| `MT6789` | `24117RN76O` | MediaTek Helio G99 Ultra | [Source 1](https://www.mi.com/tw/product/redmi-note-14/specs/) |
| `MT6789` | `SHARK 8` | MediaTek Helio G99 | [Source 1](https://store.blackview.hk/products/shark-8-price) |
| `MT6789` | `Infinix X6833B` | MediaTek Helio G99 | [Source 1](https://mx.infinixmobility.com/note-30), [Source 2](https://wap.mx.infinixmobility.com/declaration_pdf/mx/Infinix_NOTE_30_X6833B_Manual_de_Usuario_Web_2023F.pdf) |
| `MT6789` | `Infinix X678B` | MediaTek Helio G99 | [Source 1](https://mx.infinixmobility.com/note-30-pro), [Source 2](https://iq.infinixmobility.com/declaration_pdf/mx/Infinix_NOTE_30_PRO_X678B_Manual_de_Usuario_Web_2023F.pdf) |
| `MT6789` | `SM-A245F` | MediaTek Helio G99 | [Source 1](https://news.samsung.com/id/samsung-galaxy-a24-pilihan-pasti-smartphone-tiga-jutaan-dengan-layar-super-amoled-dan-memori-besar), [Source 2](https://news.samsung.com/my/samsung-malaysia-redefines-awesome-with-new-and-improved-galaxy-a24) |
| `MT6895` | `V2314A` | MediaTek Dimensity 8200 | [Source 1](https://m.vivo.com.cn/vivo/param/iqooz8) |
| `MT6895` | `PJH110` | MediaTek Dimensity 8200 | [Source 1](https://www.oppo.com/cn/smartphones/series-reno/reno11/), [Source 2](https://www.oppo.com/cn/smartphones/series-reno/reno11/specs/) |
| `MT6899` | `V2452A` | MediaTek Dimensity 8400 | [Source 1](https://www.vivo.com.cn/vivo/param/iqooz10turbo) |
| `MT6899` | `SER-AN00` | MediaTek Dimensity 8500 Elite | [Source 1](https://www.honor.com/cn/phones/honor-power2/), [Source 2](https://developer.honor.com/cn/docs/game_center/guides/jieruzhinan/jixing) |
| `MT6897` | `CPH2737` | MediaTek Dimensity 8350 | [Source 1](https://www.oppo.com/en/smartphones/series-reno/reno14/), [Source 2](https://www.oppo.com/dk/smartphones/series-reno/reno14/specs/) |
| `MT6785` | `Redmi Note 8 Pro` | MediaTek Helio G90T | [Source 1](https://www.mi.com/es/redmi-note-8-pro/specs) |
| `MT6769` | `SM-A225F` | MediaTek Helio G80 | [Source 1](https://news.samsung.com/br/samsung-apresenta-galaxy-a22-no-brasil), [Source 2](https://www.samsung.com/az/support/model/SM-A225FZKGCAU/) |
| `MT6765` | `SM-A045F` | MediaTek Helio P35 | [Source 1](https://news.samsung.com/in/samsung-expands-entry-segment-portfolio-with-galaxy-a04-and-galaxy-a04e-fast-performance-with-up-to-8gb-ram-with-ram-plus-and-50mp-camera), [Source 2](https://www.samsung.com/ae/support/model/SM-A045FZKGMEA/) |
| `MT6879` | `motorola edge 40 neo` | MediaTek Dimensity 7030 | [Source 1](https://www.motorola.com/gb/en/p/phones/motorola-edge/40-neo/pmipmge35mt) |
| `SM6225` | `CPH2333` | Snapdragon 680 | [Source 1](https://www.oppo.com/en/smartphones/series-a/a96/specs/) |
| `SM6225` | `CPH2565` | Snapdragon 680 | [Source 1](https://www.oppo.com/en/smartphones/series-a/a78/specs/) |
| `SM6225` | `CPH2819` | Snapdragon 685 | [Source 1](https://www.oppo.com/en/smartphones/series-a/a6x/specs/) |
| `SM6225` | `2201117TG` | Snapdragon 680 | [Source 1](https://www.mi.com/global/product/redmi-note-11/specs/), [Source 2](https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/7b913ad8e7ddc34c7cf886bc79869bc9.pdf) |
| `SM6225` | `2201117TI` | Snapdragon 680 | [Source 1](https://www.mi.com/global/product/redmi-note-11/specs/), [Source 2](https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/003e5382815b50e70b09eb5e0bf744e2.pdf) |
| `SM6225` | `220333QNY` | Snapdragon 680 | [Source 1](https://www.mi.com/global/product/redmi-10c/specs/), [Source 2](https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/f5fcab41ef941982faac95f509f6fee9.pdf) |
| `SM6225` | `23021RAA2Y` | Snapdragon 685 | [Source 1](https://www.mi.com/global/product/redmi-note-12/specs/), [Source 2](https://alsgp0.fds.api.xiaomi.com/gl123/Redmi/Redmi%20Note%2012/%E9%87%8F%E4%BA%A7/M7N/M7N_QSG_%E6%AC%A7%E8%A7%8414%E8%AF%AD%E7%89%88_20221220.pdf) |
| `SM6225` | `HEY-W09` | Snapdragon 680 | [Source 1](https://www.honor.com/es/tablets/honor-pad-8/buy/), [Source 2](https://www.honor.com/content/dam/honor/pl/support/product-manual/honor-pad-8-qsg.pdf), [Source 3](https://www.honor.com/mx/news/launch-press-release-honor-lanza-por-primera-vez-en/) |
| `SM6225` | `SM-A057M` | Snapdragon 680 | [Source 1](https://www.samsung.com/br/smartphones/galaxy-a/galaxy-a05s-silver-128gb-sm-a057mzshzto/) |
| `SM6225` | `SM-A235F` | Snapdragon 680 | [Source 1](https://news.samsung.com/id/galaxy-a23-sudah-bisa-dibeli-langsung-ini-empat-fitur-premium-yang-bikin-kamu-awesome), [Source 2](https://www.samsung.com/levant/support/model/SM-A235FZOKMEB/), [Source 3](https://images.samsung.com/is/content/samsung/assets/iran/smartphones/mobile-catalogue/samsung-mobile-digital-catalogue-20220425-mob.pdf) |
| `SM6225` | `moto g play - 2024` | Snapdragon 680 | [Source 1](https://en-us.support.motorola.com/app/answers/detail/a_id/177738/~/specifications--moto-g-play-%282024%29) |
| `SM6375` | `2201116SG` | Snapdragon 695 | [Source 1](https://www.mi.com/br/product/redmi-note-11-pro-5g/specs/), [Source 2](https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/494bed1d36680ca0c5e889dc84b00d2e.pdf) |
| `SM6375` | `RMO-NX1` | Snapdragon 695 | [Source 1](https://www.honor.com/content/dam/honor/hr/support/product-manual/honor-magic5-lite-qsg.pdf), [Source 2](https://www.honor.com/uk/phones/honor-magic5-lite/buy/) |
| `SM6375` | `moto g34 5G` | Snapdragon 695 | [Source 1](https://www.motorola.com/gb/en/p/phones/moto-g/34-5g/pmipmgk36mp) |
| `SM6375` | `moto g71 5G` | Snapdragon 695 | [Source 1](https://motorolanews.com/new-moto-g-family-brings-premium-connectivity-to-the-market/) |
| `SM8250` | `POCO F2 Pro` | Snapdragon 865 | [Source 1](https://www.po.co/global/poco-f2-pro/specs/) |
| `SM8250` | `V2199A` | Snapdragon 870 | [Source 1](https://m.vivo.com.cn/vivo/param/iqooneo6se) |
| `SM7635` | `Fairphone 6` | Snapdragon 7s Gen 3 | [Source 1](https://www.fairphone.com/the-new-fairphone) |
| `MT6985` | `V2241A` | MediaTek Dimensity 9200 | [Source 1](https://www.vivo.com.cn/vivo/param/x90) |
| `MT6985` | `V2362A` | MediaTek Dimensity 9200+ | [Source 1](https://m.vivo.com.cn/vivo/param/s19pro) |
| `MT6985` | `PGFM10` | MediaTek Dimensity 9200 | [Source 1](https://www.oppo.com/cn/smartphones/series-find-x/find-x6/specs/) |
| `MT6877` | `SM-A346E` | MediaTek Dimensity 1080 | [Source 1](https://i.mediatek.com/mediatek-india-news), [Source 2](https://www.samsung.com/eg/support/model/SM-A346EZKCMEA/) |
