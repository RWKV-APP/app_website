/** The single maintained chip identity table. Sources and exact device constraints live here.
 * Never turn a shared platform code into an unconditional alias. See docs/telemetry-soc-names.md.
 */
export interface TelemetryChip {
  name: string
  aliases?: readonly string[]
  devices?: readonly {
    models: readonly string[]
    platforms: readonly string[]
  }[]
  sources?: readonly string[]
  note?: string
}

export const TELEMETRY_CHIP_REGISTRY: readonly TelemetryChip[] = [
  {
    name: 'Exynos 2600',
    aliases: ['SM-S942B'],
    note: 'Established Galaxy S26 device rule migrated from telemetry.service.ts; no new hardware inference.'
  },
  {
    name: 'Snapdragon 4 Gen 1',
    aliases: ['SM4375'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-4-Gen-1-Product-Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 6 Gen 3',
    aliases: ['SM6475', 'SM6475-AB'],
    sources: [
      'https://docs.qualcomm.com/doc/87-82624-1/87-82624-1_REV_A_Snapdragon_6_Gen_3_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 710',
    aliases: ['SDM710'],
    sources: ['https://www.qualcomm.com/smartphones/products/7-series']
  },
  {
    name: 'Snapdragon 670',
    aliases: ['SDM670'],
    sources: [
      'https://docs.qualcomm.com/bundle/publicresource/87-43683-1_REV_A_SNAPDRAGON_685_4G_MOBILE_PLATFORM_PRODUCT_BRIEF.pdf',
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/snadragon-6s-4g-gen-2-product-brief.pdf',
      'https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp4156.pdf'
    ]
  },
  {
    name: 'Snapdragon 7 Gen 3',
    aliases: ['SM7550', 'SM7550-AB'],
    sources: [
      'https://docs.qualcomm.com/bundle/publicresource/87-64372-1_REV_B_Snapdragon_7_Gen_3_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 6 Gen 1',
    aliases: ['SM6450'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/product_brief_snapdragon_6_gen_1.pdf'
    ]
  },
  {
    name: 'Snapdragon 7+ Gen 2',
    aliases: ['SM7475', 'SM7475-AB'],
    sources: [
      'https://docs.qualcomm.com/doc/87-43682-1/87-43682-1_REV_B_Snapdragon_7__Gen_2_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 720G',
    aliases: ['SM7125'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/qualcomm_snapdragon_720g_mobile_platform_product_brief_0.pdf'
    ]
  },
  {
    name: 'Snapdragon 7 Gen 4',
    aliases: ['SM7750', 'SM7750-AB'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-7-Gen-4-Mobile-Platform-Product-Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 460',
    aliases: ['SM4250', 'SM4250-AA'],
    sources: [
      'https://www.qualcomm.com/media/documents/files/qualcomm-snapdragon-460-mobile-platform-product-brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 8 Gen 3',
    aliases: ['SM8650'],
    sources: [
      'https://docs.qualcomm.com/bundle/publicresource/87-71408-1_REV_G_Snapdragon_8_gen_3_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 4s Gen 2',
    aliases: ['SM4635'],
    sources: [
      'https://docs.qualcomm.com/doc/87-78935-1/87-78935-1_REV_B_Snapdragon_4s_Gen_2_Mobile_Platform_Product_Brief____.pdf'
    ]
  },
  {
    name: 'Snapdragon 7+ Gen 3',
    aliases: ['SM7675', 'SM7675-AB'],
    sources: [
      'https://docs.qualcomm.com/doc/87-73943-1/87-73943-1_REV_C_Snapdragon_7__Gen_3_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 845',
    aliases: ['SDM845'],
    sources: [
      'https://www.qualcomm.com/processors/application-processors/products/sdm845'
    ]
  },
  {
    name: 'Snapdragon 7 Gen 1',
    aliases: ['SM7450'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-7-Gen-1-Product-Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 7s Gen 2',
    aliases: ['SM7435', 'SM7435-AB'],
    sources: [
      'https://docs.qualcomm.com/doc/87-64361-1/87-64361-1_REV_B_Snapdragon_7s_Gen_2_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 750G 5G',
    aliases: ['SM7225'],
    devices: [
      {
        models: ['M2007J17C', 'M2007J17G'],
        platforms: ['SM7250']
      }
    ],
    sources: [
      'https://www.qualcomm.com/media/documents/files/snapdragon-750g-5g-mobile-platform-product-brief.pdf',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/redminote9pro/specs',
      'https://www.mi.com/uk/mi-10t-lite/'
    ],
    note: '设备为中国Redmi Note 9 Pro和Mi 10T Lite，OEM明确750G。上传SM7250与通常料号不同，不把SM7250全局改成750G。'
  },
  {
    name: 'Qualcomm Dragonwing QCM6490',
    aliases: ['QCM6490'],
    sources: [
      'https://www.qualcomm.com/internet-of-things/products/q6-series/qcm6490'
    ]
  },
  {
    name: 'Snapdragon 888',
    aliases: ['888'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'MediaTek Dimensity 800',
    aliases: ['MT6873', 'MediaTek Dimensity 800 5G'],
    sources: ['https://store.ulefone.com/pages/armor-10-specs']
  },
  {
    name: 'MediaTek Helio G96',
    aliases: ['MT6781'],
    sources: [
      'https://www.mi.com/sg/support/faq/details/KA-07867/',
      'https://www.mi.com/global/product/redmi-note-11s/specs/'
    ]
  },
  {
    name: 'Google Tensor',
    aliases: ['pixel6', 'pixel6a', 'pixel6pro'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'Google Tensor G2',
    aliases: ['pixel7', 'pixel7a', 'pixel7pro', 'pixelseven'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'Google Tensor G3',
    aliases: ['pixel8', 'pixel8a', 'pixel8pro'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'Google Tensor G4',
    aliases: ['pixel9', 'pixel9a', 'pixel9pro', 'pixel9proxl', 'pixel10a'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'Google Tensor G5',
    aliases: ['pixel10', 'pixel10pro', 'pixel10proxl'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'AMD Ryzen 7 7840HS w/ Radeon 780M Graphics',
    aliases: ['amd ryzen 7 7840hs with radeon 780m graphics'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'MediaTek Helio P90',
    devices: [
      {
        models: ['bv8900'],
        platforms: ['MT6779']
      }
    ],
    sources: ['https://www.blackview.hk/products/item/bv8900']
  },
  {
    name: 'MediaTek Dimensity 9000',
    devices: [
      {
        models: ['cph2493'],
        platforms: ['MT6983']
      }
    ],
    sources: [
      'https://www.oneplus.com/uk/pstisoc',
      'https://www.oneplus.in/nord-3-5g'
    ]
  },
  {
    name: 'MediaTek Helio G99',
    devices: [
      {
        models: ['22071219cg'],
        platforms: ['MT6789']
      },
      {
        models: ['shark 8'],
        platforms: ['MT6789']
      },
      {
        models: ['infinix x6833b'],
        platforms: ['MT6789']
      },
      {
        models: ['infinix x678b'],
        platforms: ['MT6789']
      },
      {
        models: ['sm-a245f'],
        platforms: ['MT6789']
      },
      {
        models: ['TECNO LH7n'],
        platforms: ['MT6789']
      }
    ],
    sources: [
      'https://www.po.co/global/product/poco-m5/',
      'https://ams-go.buy.mi.com/it/servicecenter/file/POCO_M5_Safety_Information_it/?binaryId=221160&namespaceId=2&publicationId=221166',
      'https://store.blackview.hk/products/shark-8-price',
      'https://mx.infinixmobility.com/note-30',
      'https://wap.mx.infinixmobility.com/declaration_pdf/mx/Infinix_NOTE_30_X6833B_Manual_de_Usuario_Web_2023F.pdf',
      'https://mx.infinixmobility.com/note-30-pro',
      'https://iq.infinixmobility.com/declaration_pdf/mx/Infinix_NOTE_30_PRO_X678B_Manual_de_Usuario_Web_2023F.pdf',
      'https://news.samsung.com/id/samsung-galaxy-a24-pilihan-pasti-smartphone-tiga-jutaan-dengan-layar-super-amoled-dan-memori-besar',
      'https://news.samsung.com/my/samsung-malaysia-redefines-awesome-with-new-and-improved-galaxy-a24',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.tecno-mobile.com/lb-en/phones/tech-specs/tecspecs/pova-5/'
    ]
  },
  {
    name: 'MediaTek Helio G99 Ultra',
    devices: [
      {
        models: ['24117rn76o'],
        platforms: ['MT6789']
      },
      {
        models: ['23117RA68G'],
        platforms: ['MT6789']
      },
      {
        models: ['2312FPCA6G'],
        platforms: ['MT6789']
      }
    ],
    sources: [
      'https://www.mi.com/tw/product/redmi-note-14/specs/',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/global/support/faq/details/KA-243090/',
      'https://www.mi.com/my/support/faq/details/KA-90061/'
    ]
  },
  {
    name: 'MediaTek Dimensity 8200',
    devices: [
      {
        models: ['v2314a'],
        platforms: ['MT6895']
      },
      {
        models: ['pjh110'],
        platforms: ['MT6895']
      }
    ],
    sources: [
      'https://m.vivo.com.cn/vivo/param/iqooz8',
      'https://www.oppo.com/cn/smartphones/series-reno/reno11/',
      'https://www.oppo.com/cn/smartphones/series-reno/reno11/specs/'
    ]
  },
  {
    name: 'MediaTek Dimensity 8400',
    devices: [
      {
        models: ['v2452a'],
        platforms: ['MT6899']
      }
    ],
    sources: ['https://www.vivo.com.cn/vivo/param/iqooz10turbo']
  },
  {
    name: 'MediaTek Dimensity 8500 Elite',
    devices: [
      {
        models: ['ser-an00'],
        platforms: ['MT6899']
      }
    ],
    sources: [
      'https://www.honor.com/cn/phones/honor-power2/',
      'https://developer.honor.com/cn/docs/game_center/guides/jieruzhinan/jixing'
    ]
  },
  {
    name: 'MediaTek Dimensity 8350',
    devices: [
      {
        models: ['cph2737'],
        platforms: ['MT6897']
      }
    ],
    sources: [
      'https://www.oppo.com/en/smartphones/series-reno/reno14/',
      'https://www.oppo.com/dk/smartphones/series-reno/reno14/specs/'
    ]
  },
  {
    name: 'MediaTek Helio G90T',
    devices: [
      {
        models: ['redmi note 8 pro'],
        platforms: ['MT6785']
      }
    ],
    sources: ['https://www.mi.com/es/redmi-note-8-pro/specs']
  },
  {
    name: 'MediaTek Helio G80',
    devices: [
      {
        models: ['sm-a225f'],
        platforms: ['MT6769']
      }
    ],
    sources: [
      'https://news.samsung.com/br/samsung-apresenta-galaxy-a22-no-brasil',
      'https://www.samsung.com/az/support/model/SM-A225FZKGCAU/'
    ]
  },
  {
    name: 'MediaTek Helio P35',
    devices: [
      {
        models: ['sm-a045f'],
        platforms: ['MT6765']
      }
    ],
    sources: [
      'https://news.samsung.com/in/samsung-expands-entry-segment-portfolio-with-galaxy-a04-and-galaxy-a04e-fast-performance-with-up-to-8gb-ram-with-ram-plus-and-50mp-camera',
      'https://www.samsung.com/ae/support/model/SM-A045FZKGMEA/'
    ]
  },
  {
    name: 'MediaTek Dimensity 7030',
    devices: [
      {
        models: ['motorola edge 40 neo'],
        platforms: ['MT6879']
      }
    ],
    sources: [
      'https://www.motorola.com/gb/en/p/phones/motorola-edge/40-neo/pmipmge35mt'
    ]
  },
  {
    name: 'Snapdragon 680',
    devices: [
      {
        models: ['cph2333'],
        platforms: ['SM6225']
      },
      {
        models: ['cph2565'],
        platforms: ['SM6225']
      },
      {
        models: ['2201117tg'],
        platforms: ['SM6225']
      },
      {
        models: ['2201117ti'],
        platforms: ['SM6225']
      },
      {
        models: ['220333qny'],
        platforms: ['SM6225']
      },
      {
        models: ['hey-w09'],
        platforms: ['SM6225']
      },
      {
        models: ['sm-a057m'],
        platforms: ['SM6225']
      },
      {
        models: ['sm-a235f'],
        platforms: ['SM6225']
      },
      {
        models: ['moto g play - 2024'],
        platforms: ['SM6225']
      }
    ],
    sources: [
      'https://www.oppo.com/en/smartphones/series-a/a96/specs/',
      'https://www.oppo.com/en/smartphones/series-a/a78/specs/',
      'https://www.mi.com/global/product/redmi-note-11/specs/',
      'https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/7b913ad8e7ddc34c7cf886bc79869bc9.pdf',
      'https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/003e5382815b50e70b09eb5e0bf744e2.pdf',
      'https://www.mi.com/global/product/redmi-10c/specs/',
      'https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/f5fcab41ef941982faac95f509f6fee9.pdf',
      'https://www.honor.com/es/tablets/honor-pad-8/buy/',
      'https://www.honor.com/content/dam/honor/pl/support/product-manual/honor-pad-8-qsg.pdf',
      'https://www.honor.com/mx/news/launch-press-release-honor-lanza-por-primera-vez-en/',
      'https://www.samsung.com/br/smartphones/galaxy-a/galaxy-a05s-silver-128gb-sm-a057mzshzto/',
      'https://news.samsung.com/id/galaxy-a23-sudah-bisa-dibeli-langsung-ini-empat-fitur-premium-yang-bikin-kamu-awesome',
      'https://www.samsung.com/levant/support/model/SM-A235FZOKMEB/',
      'https://images.samsung.com/is/content/samsung/assets/iran/smartphones/mobile-catalogue/samsung-mobile-digital-catalogue-20220425-mob.pdf',
      'https://en-us.support.motorola.com/app/answers/detail/a_id/177738/~/specifications--moto-g-play-%282024%29'
    ]
  },
  {
    name: 'Snapdragon 685',
    aliases: ['SM6225-AD'],
    devices: [
      {
        models: ['cph2819'],
        platforms: ['SM6225']
      },
      {
        models: ['23021raa2y'],
        platforms: ['SM6225']
      },
      {
        models: ['ALT-LX1', 'ALT-LX2', 'RMX3890', '25062RN2DE', '23124RA7EO'],
        platforms: ['SM6225']
      }
    ],
    sources: [
      'https://www.oppo.com/en/smartphones/series-a/a6x/specs/',
      'https://www.mi.com/global/product/redmi-note-12/specs/',
      'https://alsgp0.fds.api.xiaomi.com/gl123/Redmi/Redmi%20Note%2012/%E9%87%8F%E4%BA%A7/M7N/M7N_QSG_%E6%AC%A7%E8%A7%8414%E8%AF%AD%E7%89%88_20221220.pdf',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.honor.com/eurasia/phones/honor-x7c/',
      'https://www.realme.com/it/realme-c67',
      'https://www.mi.com/global/product/redmi-15/specs/',
      'https://www.mi.com/global/product/redmi-note-13/specs/',
      'https://docs.qualcomm.com/bundle/publicresource/87-43683-1_REV_A_SNAPDRAGON_685_4G_MOBILE_PLATFORM_PRODUCT_BRIEF.pdf'
    ]
  },
  {
    name: 'Snapdragon 695',
    devices: [
      {
        models: ['2201116sg'],
        platforms: ['SM6375']
      },
      {
        models: ['rmo-nx1'],
        platforms: ['SM6375']
      },
      {
        models: ['moto g34 5g'],
        platforms: ['SM6375']
      },
      {
        models: ['moto g71 5g'],
        platforms: ['SM6375']
      },
      {
        models: ['2201116SI', 'moto g82 5G', 'CPH2513'],
        platforms: ['SM6375']
      }
    ],
    sources: [
      'https://www.mi.com/br/product/redmi-note-11-pro-5g/specs/',
      'https://alsgp0.fds.api.xiaomi.com/xiaomi-b2c-i18n-upload/user-guides/494bed1d36680ca0c5e889dc84b00d2e.pdf',
      'https://www.honor.com/content/dam/honor/hr/support/product-manual/honor-magic5-lite-qsg.pdf',
      'https://www.honor.com/uk/phones/honor-magic5-lite/buy/',
      'https://www.motorola.com/gb/en/p/phones/moto-g/34-5g/pmipmgk36mp',
      'https://motorolanews.com/new-moto-g-family-brings-premium-connectivity-to-the-market/',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/in/product/redmi-note-11-pro-plus-5g/specs/',
      'https://www.motorola.com/kr/ko/p/phones/moto-g/82-5g/pmipmgf35mx',
      'https://www.oneplus.com/us/n30-5g/specs'
    ]
  },
  {
    name: 'Snapdragon 865',
    devices: [
      {
        models: ['poco f2 pro'],
        platforms: ['SM8250']
      },
      {
        models: ['NX659J'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://www.po.co/global/poco-f2-pro/specs/',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://global.redmagic.gg/blogs/news/redmagic-5g-now-available'
    ]
  },
  {
    name: 'Snapdragon 870',
    aliases: ['SM8250-AC'],
    devices: [
      {
        models: ['v2199a'],
        platforms: ['SM8250']
      }
    ],
    sources: [
      'https://m.vivo.com.cn/vivo/param/iqooneo6se',
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/prod_brief_qcom_sd870_5g.pdf'
    ]
  },
  {
    name: 'Snapdragon 7s Gen 3',
    devices: [
      {
        models: ['fairphone 6'],
        platforms: ['SM7635']
      },
      {
        models: ['24115RA8EC', '24115RA8EI', 'A059', 'A059P'],
        platforms: ['SM7635']
      }
    ],
    sources: [
      'https://www.fairphone.com/the-new-fairphone',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/in/product/redmi-note-14-pro-plus-5g/specs/',
      'https://www.mi.com/au/product/redmi-note-14-pro-plus-5g/specs/',
      'https://ae.nothing.tech/en/pages/phone-3a',
      'https://docs.qualcomm.com/doc/87-78936-1/87-78936-1_REV_A_Snapdragon_7s_Gen_3_Mobile_Platform_Product_Brief.pdf'
    ],
    note: 'Google官方型号表分别为Redmi Note 14 Pro+/Pro+ 5G及Nothing Phone (3a)/(3a) Pro；不全局绑定SM7635。'
  },
  {
    name: 'MediaTek Dimensity 9200',
    devices: [
      {
        models: ['v2241a'],
        platforms: ['MT6985']
      },
      {
        models: ['pgfm10'],
        platforms: ['MT6985']
      }
    ],
    sources: [
      'https://www.vivo.com.cn/vivo/param/x90',
      'https://www.oppo.com/cn/smartphones/series-find-x/find-x6/specs/'
    ]
  },
  {
    name: 'MediaTek Dimensity 9200+',
    devices: [
      {
        models: ['v2362a'],
        platforms: ['MT6985']
      },
      {
        models: ['23078RKD5C'],
        platforms: ['MT6985']
      }
    ],
    sources: [
      'https://m.vivo.com.cn/vivo/param/s19pro',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2023/08/29/6-36-44/2023082900551.pdf'
    ]
  },
  {
    name: 'MediaTek Dimensity 1080',
    devices: [
      {
        models: ['sm-a346e'],
        platforms: ['MT6877']
      },
      {
        models: ['Infinix X6815C'],
        platforms: ['MT6877']
      },
      {
        models: ['22101316G'],
        platforms: ['MT6877']
      }
    ],
    sources: [
      'https://i.mediatek.com/mediatek-india-news',
      'https://www.samsung.com/eg/support/model/SM-A346EZKCMEA/',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.prnewswire.com/news-releases/infinix-launches-zero-5g-2023-smartphone-with-powerful-performance-and-storage-upgrades-301684593.html',
      'https://www.mi.com/es/product/redmi-note-12-pro-5g/specs/'
    ],
    note: 'Manufacturer-authored Infinix launch release; Google model join.'
  },
  {
    name: 'A16 Bionic',
    aliases: ['iPhone 15', 'iPhone 15 Plus'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'A17 Pro',
    aliases: ['iPhone 15 Pro', 'iPhone 15 Pro Max'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'A18',
    aliases: ['iPhone 16', 'iPhone 16 Plus', 'iPhone 16e'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'A18 Pro',
    aliases: ['iPhone 16 Pro', 'iPhone 16 Pro Max'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'A19',
    aliases: ['iPhone 17'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'A19 Pro',
    aliases: ['iPhone 17 Pro', 'iPhone 17 Pro Max', 'iPhone Air'],
    note: 'Existing verified spelling/device rule migrated from telemetry-soc.ts or appleDeviceInfo.ts; no new hardware inference.'
  },
  {
    name: 'Snapdragon 778G',
    devices: [
      {
        models: ['V2148A', '22101320G', '2203129G', 'SM-A528B'],
        platforms: ['778']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.vivo.com.cn/vivo/param/iqooz5',
      'https://www.po.co/global/product/poco-x5-pro-5g/specs/',
      'https://www.mi.com/global/support/faq/details/KA-11459/',
      'https://news.samsung.com/fr/galaxy-a52s-5g'
    ]
  },
  {
    name: 'Snapdragon 778G+',
    aliases: ['SM7325-AE'],
    devices: [
      {
        models: ['FNE-AN00', 'motorola edge 30', 'A063'],
        platforms: ['778']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://developer.honor.com/cn/docs/game_center/guides/jieruzhinan/jixing',
      'https://www.honor.com/za/support/content/en-us15875891/',
      'https://www.lenovo.com/ie/en/p/phones/moto/moto-edge-series/xt2203-1/pauc0003gb',
      'https://us.nothing.tech/pages/phone-1',
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ]
  },
  {
    name: 'Snapdragon 778G 4G',
    devices: [
      {
        models: ['NAM-AL00'],
        platforms: ['SM7325']
      }
    ],
    sources: [
      'https://consumer.huawei.com/hk/mobileservices/huawei-wallet/support-devices/',
      'https://consumer.huawei.com/hk/press/news/2021/nova_9/',
      'https://consumer.huawei.com/jo/phones/nova9/specs/'
    ],
    note: 'Huawei官方wallet表将NAM-AL00列为nova 9；消费者芯片名明确为778G 4G，应与5G是否合并遵从现有规范。'
  },
  {
    name: 'Snapdragon 732G',
    aliases: ['SM7150-AC'],
    devices: [
      {
        models: ['2209116AG', 'M2007J20CG'],
        platforms: ['SM7150']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/nl/product/redmi-note-12-pro/specs/',
      'https://www.po.co/global/poco-x3-nfc/specs/',
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ]
  },
  {
    name: 'Snapdragon 765G',
    aliases: ['SM7250-AB'],
    devices: [
      {
        models: ['PEGM00'],
        platforms: ['SM7250']
      }
    ],
    sources: [
      'https://bdev.oppo.com/open/resource/index/document/detail?id=100',
      'https://www.oppo.com/za/smartphones/series-reno/reno5-5g/specs/',
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ],
    note: 'OPPO企业设备表精确PEGM00=Reno5；官方5G版765G。'
  },
  {
    name: 'Snapdragon 4 Gen 2',
    devices: [
      {
        models: ['23076RN8DY'],
        platforms: ['SM4450']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/global/product/redmi-12-5g/specs/'
    ]
  },
  {
    name: 'Snapdragon 450',
    devices: [
      {
        models: ['Core-X4'],
        platforms: ['SM8953']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://content.crosscall.com/wp-content/uploads/2020/02/CP_LANCEMENT_GAMME_CORE_FR.pdf'
    ],
    note: 'Crosscall官网明确CORE-X4为SDM450；上传SM8953不可作为全局真实料号。'
  },
  {
    name: 'Snapdragon 730G',
    aliases: ['SM7150-AB'],
    devices: [
      {
        models: ['SM-M515F'],
        platforms: ['SM6150']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://images.samsung.com/is/content/samsung/assets/in/at-activity/20210324-catalog-pdp/mseries.pdf',
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ],
    note: '三星官方M51规格与上报SM6150不同，按精确设备映射730G。'
  },
  {
    name: 'Snapdragon 855',
    devices: [
      {
        models: ['SM-G975U'],
        platforms: ['SM8150']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://image-us.samsung.com/SamsungUS/samsungbusiness/pdfs/datasheet/HHP-CARRIERAGNOSTIC-GALAXYS10ES10S10%2BDSHT-MAR19T_Final_3-7-19.pdf'
    ]
  },
  {
    name: 'Snapdragon 662',
    devices: [
      {
        models: ['V2065A'],
        platforms: ['snapdragon_soc']
      },
      {
        models: ['V2065A', 'moto g power (2021)'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://www.vivo.com.cn/vivo/param/iqoou1x',
      'https://www.lenovo.com/us/en/p/phones/motorola-smartphones/motorola-moto-g/moto-g-power/palf0023us'
    ],
    note: 'Lenovo官方Motorola G Power (2021)产品页列Qualcomm Snapdragon 662 Mobile Processor。'
  },
  {
    name: 'Xiaomi XRING O1',
    devices: [
      {
        models: ['25042PN24C'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://ir.mi.com/static-files/5e0e71ff-8769-45f0-ba3e-fc8a37ab9feb'
    ],
    note: '上传snapdragon_soc仅是错误/泛化平台值；Google型号表明确Xiaomi 15S Pro，Xiaomi投资者材料明确XRING O1。'
  },
  {
    name: 'Snapdragon 480+',
    aliases: ['SM4350-AC'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/product_brief_-_snapdragon_480_plus_5g_mobile_platform.pdf',
      'https://developer.honor.com/cn/docs/game_center/guides/jieruzhinan/jixing',
      'https://www.honor.com/cn/phones/honor-changwan-40/spec/',
      'https://www.honor.com/cn/phones/honor-changwan-40c/spec/',
      'https://www.honor.com/cn/phones/honor-changwan-40s/spec/'
    ],
    devices: [
      {
        models: ['WDY-AN00'],
        platforms: ['SM4350']
      }
    ],
    note: 'HONOR官方设备表WDY-AN00对应畅玩40/40C/40S；三款官方规格HTML的CPU型号data-value均为高通骁龙480 Plus。仅设备限定，不把SM4350裸值作为480+全局别名。'
  },
  {
    name: 'Snapdragon 6s Gen 3',
    aliases: ['SM6375-AC'],
    sources: [
      'https://docs.qualcomm.com/doc/87-75277-1/87-75277-1_REV_A_Snapdragon_6s_Gen_3_Mobile_Platform_Product_Brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 865+',
    aliases: ['SM8250-AB'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/snapdragon_865_product_brief.pdf'
    ]
  },
  {
    name: 'Snapdragon 765',
    aliases: ['SM7250-AA'],
    sources: [
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ]
  },
  {
    name: 'Snapdragon 768G',
    aliases: ['SM7250-AC'],
    sources: [
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ]
  },
  {
    name: 'Snapdragon 782G',
    aliases: ['SM7325-AF'],
    sources: [
      'https://www.qualcomm.com/company/product-security/bulletins/february-2024-bulletin'
    ]
  },
  {
    name: 'Exynos 1380',
    devices: [
      {
        models: ['SM-A356B'],
        platforms: ['sm-a356b']
      },
      {
        models: ['SM-A546E'],
        platforms: ['sm-a546e']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://news.samsung.com/in/samsung-launches-galaxy-a55-5g-and-galaxy-a35-5g-with-flagship-like-camera-innovations-and-samsung-knox-vault-protection',
      'https://news.samsung.com/br/samsung-galaxy-a54-5g-e-galaxy-a34-5g-experiencias-incriveis-para-todos'
    ],
    note: 'Google官方设备列表精确绑定SM-A356B为Galaxy A35 5G、SM-A546E为Galaxy A54 5G；三星官方发布规格明确对应Exynos 1380。'
  },
  {
    name: 'Exynos 1330',
    devices: [
      {
        models: ['SM-A146B'],
        platforms: ['sm-a146b']
      },
      {
        models: ['SM-A146M'],
        platforms: ['sm-a146m']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://doc.samsungmobile.com/SM-A146B/025623230130/hin.html',
      'https://doc.samsungmobile.com/SM-A146M/025690230215/por-br.html',
      'https://news.samsung.com/in/samsung-launches-galaxy-a14-5g-and-galaxy-a23-5g-to-consolidate-5g-leadership-in-india',
      'https://news.samsung.com/br/samsung-apresenta-galaxy-a14-5g-no-brasil'
    ],
    note: '型号→Galaxy A14 5G由Google官方表及三星型号更新页证明；处理器由印度及巴西三星发布稿证明。属于跨官方资料推断，未找到单页同时写出精确型号和Exynos1330；A14 5G存在其他地区SoC，不扩大到其他A146后缀。'
  },
  {
    name: 'Exynos 1280',
    devices: [
      {
        models: ['SM-A536V'],
        platforms: ['sm-a536v']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://image-us.samsung.com/SamsungUS/samsungbusiness/resources/pdfs/galaxy-smartphone-portfolio/Smartphones_Portfolio_Flyer-SEP22T.pdf'
    ],
    note: 'Google官方表SM-A536V为Galaxy A53 5G UW；三星美国官方产品表A53 5G处理器Exynos1280，同一列明确包含Galaxy A53 5G UW mmWave变体。'
  },
  {
    name: 'Exynos 1480',
    devices: [
      {
        models: ['SM-A556B'],
        platforms: ['sm-a556b']
      },
      {
        models: ['SM-A556E'],
        platforms: ['sm-a556e']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://news.samsung.com/in/samsung-launches-galaxy-a55-5g-and-galaxy-a35-5g-with-flagship-like-camera-innovations-and-samsung-knox-vault-protection',
      'https://news.samsung.com/fr/galaxy_a55_5g_galaxy_a35_5g'
    ],
    note: 'Google官方表两个精确型号均为Galaxy A55 5G；三星印度和法国发布稿均明确Exynos1480。'
  },
  {
    name: 'UNISOC T606',
    devices: [
      {
        models: ['SM-A035M'],
        platforms: ['sm-a035m']
      },
      {
        models: ['moto e13'],
        platforms: ['moto e13']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://news.samsung.com/in/samsung-india-launches-galaxy-a03-with-true-48mp-camera-the-first-a-series-smartphone-of-2022',
      'https://es-latam.support.motorola.com/app/answers/detail/a_id/176750/~/especificaciones---moto-e13'
    ],
    note: 'Google官方表SM-A035M为Galaxy A03，三星官方规格明确T606；Motorola拉美官方moto e13规格直接明确UNISOC T606。'
  },
  {
    name: 'UNISOC T612',
    devices: [
      {
        models: ['RMX3834'],
        platforms: ['rmx3834']
      },
      {
        models: ['RMX3623'],
        platforms: ['rmx3623']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.realme.com/ph/realme-note50/specs',
      'https://www.realme.com/mea-en/realme-c30/specs'
    ],
    note: 'Google官方表RMX3834为realme Note50、RMX3623为realme C30；各自官方规格均明确T612，RMX3623不能按C30s规格归为SC9863A。'
  },
  {
    name: 'Exynos 2200',
    devices: [
      {
        models: ['SM-S901B'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://www.samsung.com/ch/support/mobile-devices/galaxy-s22-vs-s22plus-vs-s22-ultra/'
    ],
    note: '三星瑞士官方对照表直接在SM-S901B列给出Exynos2200(S5E9925)；上传平台snapdragon_soc在该型号上错误。'
  },
  {
    name: 'Exynos 2400',
    devices: [
      {
        models: ['SM-S921B'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://www.samsung.com/de/support/mobile-devices/vergleich-galaxy-s24-galaxy-s24-fe/',
      'https://www.samsung.com/es/business/smartphones/galaxy-s/galaxy-s24-sm-s921bzkgeub/buy/'
    ],
    note: '三星官方表直接将SM-S921B列处理器写为Exynos2400；上传平台snapdragon_soc在该型号上错误。'
  },
  {
    name: 'Exynos 2400e',
    devices: [
      {
        models: ['SM-S721B'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://www.samsung.com/de/support/mobile-devices/vergleich-galaxy-s24-galaxy-s24-fe/',
      'https://www.samsung.com/br/smartphones/galaxy-s/galaxy-s24-fe-marble-gray-256gb-sm-s721bzakzto/'
    ],
    note: '三星官方规格直接将SM-S721B绑定Exynos2400e，上传平台snapdragon_soc在该型号上错误。注意同站另一S24FE/S23FE对照页存在表格笔误，不使用该错误页。'
  },
  {
    name: 'Exynos 1580',
    devices: [
      {
        models: ['SM-A566B'],
        platforms: ['snapdragon_soc']
      }
    ],
    sources: [
      'https://www.samsung.com/es/business/smartphones/galaxy-a/galaxy-a56-5g-awesome-graphite-128gb-sm-a566bzkaeub/buy/'
    ],
    note: '三星西班牙官方SM-A566B商品页明确Exynos1580；上传平台snapdragon_soc在该型号上错误。'
  },
  {
    name: 'MediaTek MT8788',
    aliases: ['MT8788'],
    sources: ['https://www.mediatek.com/iot/modem-based-iot/mt8788'],
    note: 'MT8788 is itself the official product name; do not relabel as Helio P60.'
  },
  {
    name: 'MediaTek Dimensity 8500',
    devices: [
      {
        models: ['V2551A'],
        platforms: ['MT6899']
      }
    ],
    sources: ['https://www.vivo.com.cn/vivo/param/iqooz11'],
    note: 'Official CPU name is 天玑8500满血版; do not infer other MT6899 devices.'
  },
  {
    name: 'MediaTek Dimensity 810',
    devices: [
      {
        models: ['V2166BA'],
        platforms: ['MT6833']
      },
      {
        models: ['21091116AG'],
        platforms: ['MT6833']
      }
    ],
    sources: [
      'https://m.vivo.com.cn/vivo/param/y77et1',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.po.co/global/product/poco-m4-pro-5g/specs/'
    ]
  },
  {
    name: 'MediaTek Dimensity 700',
    devices: [
      {
        models: ['PHJ110'],
        platforms: ['MT6833']
      },
      {
        models: ['DIO-AN00'],
        platforms: ['MT6833']
      },
      {
        models: ['M2103K19G'],
        platforms: ['MT6833']
      }
    ],
    sources: [
      'https://www.oppo.com/cn/smartphones/series-a/a1x/specs/',
      'https://www.honor.com/cn/shop/product/10086462927545.html',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/global/product/redmi-note-10-5g/specs/'
    ]
  },
  {
    name: 'MediaTek Dimensity 7300',
    devices: [
      {
        models: ['S200 Plus'],
        platforms: ['MT6878']
      }
    ],
    sources: ['https://www.doogee.com/zh-hans/pages/s200-plus-specs']
  },
  {
    name: 'MediaTek Dimensity 7060',
    devices: [
      {
        models: ['moto g56 5G'],
        platforms: ['MT6855']
      }
    ],
    sources: [
      'https://www.motorola.com/we/en/p/phones/moto-g/56-5g/pmipmhu41mg'
    ]
  },
  {
    name: 'MediaTek Helio G81 Extreme',
    devices: [
      {
        models: ['moto g05'],
        platforms: ['MT6768']
      }
    ],
    sources: [
      'https://en-gb.support.motorola.com/app/answers/detail/a_id/183975'
    ]
  },
  {
    name: 'MediaTek Dimensity 8350 Apex',
    devices: [
      {
        models: ['CPH2719'],
        platforms: ['MT6897']
      }
    ],
    sources: [
      'https://www.oneplus.com/uk/pstisoc',
      'https://www.oneplus.com/lv/nord-ce5'
    ]
  },
  {
    name: 'MediaTek Dimensity 6300',
    devices: [
      {
        models: ['TB336FU'],
        platforms: ['MT8755']
      }
    ],
    sources: [
      'https://store.lenovo.com/in/en/tb336fu-tab-8g-256glg-in-ons-miib-zafr0900in-23363.html'
    ]
  },
  {
    name: 'MediaTek Helio G88',
    devices: [
      {
        models: ['CRT-LX2'],
        platforms: ['MT6768']
      },
      {
        models: ['RMX3710'],
        platforms: ['MT6768']
      },
      {
        models: ['22011119UY', '21061119AG'],
        platforms: ['MT6768']
      },
      {
        models: ['TECNO LF7'],
        platforms: ['MT6769']
      }
    ],
    sources: [
      'https://www.honor.com/my/phones/honor-x8a/spec/',
      'https://www.realme.com/cn/legal/security-mend',
      'https://www.realme.com/eu/realme-c55/specs',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/fr/product/redmi-10-2022/specs',
      'https://www.tecno-mobile.com/ph/phones/tech-specs/techspecs/pova-3-13/'
    ]
  },
  {
    name: 'MediaTek Dimensity 7025 Ultra',
    devices: [
      {
        models: ['ABR-NX1'],
        platforms: ['MT6855']
      }
    ],
    sources: [
      'https://www.honor.com/content/dam/honor/common/accessibility/pdf/Test_Report_refer_to_EN301_549_V13-HONOR_400_Lite.pdf',
      'https://www.honor.com/eurasia/phones/honor-400-lite/'
    ]
  },
  {
    name: 'MediaTek Dimensity 1200',
    devices: [
      {
        models: ['RMX3350'],
        platforms: ['MT6893']
      },
      {
        models: ['M2012K10C'],
        platforms: ['MT6893']
      }
    ],
    sources: [
      'https://www.realme.com/cn/legal/security-mend',
      'https://www.realme.com/realme-gt-neo-flash',
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/redmik40gaming/specs'
    ],
    note: 'Official page HTML meta description explicitly says 天玑1200; browser text extraction omits dynamic specs.'
  },
  {
    name: 'MediaTek Dimensity 720',
    devices: [
      {
        models: ['ZTE 8012N'],
        platforms: ['MT6853']
      }
    ],
    sources: [
      'https://www.ztedevices.com/cn/apps/zte-blade-v2021-5g%EF%BC%88zte-8012n%EF%BC%89/',
      'https://www.ztedevices.com/cn/product/%E4%B8%AD%E5%85%B4v2021/'
    ]
  },
  {
    name: 'MediaTek Dimensity 8200 Ultimate',
    devices: [
      {
        models: ['TECNO CL9'],
        platforms: ['MT6895']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.tecno-mobile.com/ci/telephones/tech-specs/techspecs/camon-30-premier-5g/'
    ]
  },
  {
    name: 'MediaTek Helio G99 Ultimate',
    devices: [
      {
        models: ['TECNO CL6'],
        platforms: ['MT6789']
      },
      {
        models: ['itel S666LN'],
        platforms: ['MT6789']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.tecno-mobile.com/co/phones/tech-specs/techspecs/camon-30/',
      'https://www.itel-life.com/products/phone/s-series/rs4'
    ]
  },
  {
    name: 'MediaTek Helio G100 Ultimate',
    devices: [
      {
        models: ['TECNO KM6'],
        platforms: ['MT6789']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.tecno-mobile.com/id/phones/tech-specs/techspecs/spark-40-pro/'
    ]
  },
  {
    name: 'MediaTek Dimensity 8350 Ultimate',
    devices: [
      {
        models: ['Infinix X6873'],
        platforms: ['MT6897']
      }
    ],
    sources: ['https://infinixmobiles.in/pages/gt-30-pro-5g']
  },
  {
    name: 'MediaTek Dimensity 8300 Ultra',
    devices: [
      {
        models: ['2311DRK48G'],
        platforms: ['MT6897']
      },
      {
        models: ['2311DRK48C'],
        platforms: ['MT6897']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/pk/product/poco-x6-pro/',
      'https://www.mi.com/redmi-k70e/specs'
    ],
    note: 'Official page HTML meta description explicitly names 天玑 8300-Ultra.'
  },
  {
    name: 'MediaTek Dimensity 8400 Ultra',
    devices: [
      {
        models: ['2412DPC0AG'],
        platforms: ['MT6899']
      },
      {
        models: ['24129RT7CC'],
        platforms: ['MT6899']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/global/product/poco-x7-pro/',
      'https://www.mi.com/prod/redmi-turbo-4/specs'
    ],
    note: 'Official page HTML meta description explicitly names 天玑 8400-Ultra.'
  },
  {
    name: 'MediaTek Dimensity 8500 Ultra',
    devices: [
      {
        models: ['2511FPC34G'],
        platforms: ['MT6899']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/global/product/poco-x8-pro/'
    ]
  },
  {
    name: 'MediaTek Helio G81 Ultra',
    devices: [
      {
        models: ['25078RA3EA', '25078RA3EL'],
        platforms: ['MT6768']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/ke/product/redmi-15c/specs/'
    ]
  },
  {
    name: 'MediaTek Helio G85',
    devices: [
      {
        models: ['23100RN82L', '23108RN04Y'],
        platforms: ['MT6768']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/uk/product/redmi-13c/specs/'
    ]
  },
  {
    name: 'MediaTek Dimensity 6020',
    devices: [
      {
        models: ['V2315'],
        platforms: ['MT6833']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://shop.vivo.com/in/product/10262?skuId=18890'
    ]
  },
  {
    name: 'MediaTek Dimensity 7200 Ultra',
    devices: [
      {
        models: ['23090RA98G'],
        platforms: ['MT6886']
      },
      {
        models: ['23090RA98C'],
        platforms: ['MT6886']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/uk/product/redmi-note-13-pro-plus-5g/specs/',
      'https://www.mi.com/redmi-note-13-pro+/specs',
      'https://cdn.cnbj1.fds.api.mi-img.com/mi.com-assets/shop/pro/js/product/redmi-note-13-pro+/specs.0ed3ca8f.js'
    ],
    note: 'Official China specs page JS render text explicitly names 天玑 7200-Ultra.'
  },
  {
    name: 'MediaTek Dimensity 7200 Pro',
    devices: [
      {
        models: ['A142'],
        platforms: ['MT6886']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://checkout.nothing.tech/pages/phone-2a'
    ]
  },
  {
    name: 'Snapdragon 7s Gen 4',
    aliases: ['SM7635-AC'],
    sources: [
      'https://www.qualcomm.com/content/dam/qcomm-martech/dm-assets/documents/Snapdragon-7s-Gen-4-product-brief.pdf'
    ],
    note: '官方Product Brief明确Part Number: SM7635-AC；裸SM7635不全局映射。'
  },
  {
    name: 'UNISOC T7250',
    devices: [
      {
        models: ['Blade10 Ultra Energy'],
        platforms: ['blade10 ultra energy']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://uk.doogee.com/blogs/all/doogee-blade10-energy-series-upgraded-energetic-10-7mm-ultra-thin-rugged-phone'
    ],
    note: 'Google官方列表包含Blade10 Ultra Energy精确型号（Doogee/Stargorilla），DOOGEE官方发布稿列出Blade10 Energy、Pro Energy、Ultra Energy三个型号并明确全系列使用T7250；不将T615或其他裸上传平台直接作为无条件alias。'
  },
  {
    name: 'MediaTek Dimensity 8100',
    devices: [
      {
        models: ['22041216C', '22041216UC'],
        platforms: ['MT6895']
      },
      {
        models: ['22041211AC'],
        platforms: ['MT6895']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://ir.mi.com/system/files-encrypted/nasdaq_kms/assets/2022/08/19/5-40-32/Annoucement_22Q2_EN.pdf',
      'https://www.linkedin.com/posts/mediatek_meet-two-high-end-redmi-k50-series-powered-activity-6915307732044496896--fwM'
    ],
    note: 'MediaTek official post explicitly distinguishes K50 (8100) from K50 Pro (9000).'
  },
  {
    name: 'MediaTek Helio P70',
    devices: [
      {
        models: ['PCPM00'],
        platforms: ['MT6771']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.oppo.com/ru/newsroom/press/a91/'
    ],
    note: 'Google Play binds PCPM00 to A91; OPPO A91 announcement explicitly names MediaTek Helio P70.'
  },
  {
    name: 'MediaTek Dimensity 1100',
    devices: [
      {
        models: ['M2104K10AC'],
        platforms: ['MT6893']
      }
    ],
    sources: [
      'https://storage.googleapis.com/play_public/supported_devices.csv',
      'https://www.mi.com/redminote10pro/specs'
    ],
    note: 'China official page HTML meta description explicitly says 天玑1100; do not apply global Snapdragon Note 10 Pro specs.'
  }
]
