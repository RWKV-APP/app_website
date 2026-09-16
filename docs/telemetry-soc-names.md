# Telemetry SoC names

The telemetry service normalizes verified public names so equivalent spellings appear together in aggregates, filter options and record drilldowns. A public name is not a claim about a device's clock rate, silicon bin, CPU configuration, runtime compatibility or expected performance. Sources below were checked on 2026-09-16.

## Normalization rules

- Keep the reported identifier and meaningful suffixes. Match an explicit allowlist; do not infer a model by numeric prefix, remove `+` or `s`, or discard package suffixes such as `-AC` and `-AF`.
- A chip-vendor document can establish a public name. A software platform code or shared Android kernel directory alone cannot establish a unique retail model. When joining OEM device specifications to device source, require the same model and record that inference.
- Expand a complete, unambiguous public-name shorthand such as `8gen1` to `Snapdragon 8 Gen 1`. Preserve `8+gen1`, `8sgen3` and `8gen3` as different names. A partial string such as `778` is insufficient to choose `778G` or `778G+`.
- Preserve unknown or ambiguous identifiers. Add an exact device constraint when a platform has several known public models; do not promote that device-specific result to a global alias.

The shared registry is [`packages/contracts/src/telemetry-soc.ts`](../packages/contracts/src/telemetry-soc.ts), consumed by [`backend/src/telemetry/telemetry.service.ts`](../backend/src/telemetry/telemetry.service.ts) and the frontend. `resolveKnownSocName` feeds device normalization and SoC filter-key normalization. This shared path affects aggregation, filter candidates and record drilldowns; a mapping change must be checked on all three. New ingest retains the client-reported SoC identifier after ordinary string cleanup instead of replacing it with the inferred public name. Historical database rows are not rewritten. Read-time normalization cannot recover a suffix or identity already discarded by an older client or stored row.

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

Other ambiguous bare Qualcomm platforms include `SM6225`, `SM6375`, `SM7150`, `SM7250`, `SM4350`, `SM4450`, `SM7325` and `SM6150`. For example, [685](https://docs.qualcomm.com/bundle/publicresource/87-43683-1_REV_A_SNAPDRAGON_685_4G_MOBILE_PLATFORM_PRODUCT_BRIEF.pdf) uses SM6225-AD and [6s 4G Gen 2](https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/snadragon-6s-4g-gen-2-product-brief.pdf) uses SM6225-AF. Keep the suffix; do not turn either into a bare-code 680 mapping. `SM8953`, `SDM670` and incomplete marketing names remain unchanged until their exact mapping is independently established.

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
