type AppLanguage = 'zh' | 'th' | 'en'

export type BenefitActionType =
  | 'charge_scan'
  | 'product_exchange'
  | 'physical_delivery'
  | 'benefit_detail'

function pickText(
  language: AppLanguage,
  text: { zh: string; th: string; en: string }
) {
  return text[language] || text.en
}

export function resolveBenefitActionType(benefit: any): BenefitActionType {
  const explicit = String(benefit?.benefit_action_type || '').trim()
  if (
    explicit === 'charge_scan' ||
    explicit === 'product_exchange' ||
    explicit === 'physical_delivery' ||
    explicit === 'benefit_detail'
  ) {
    return explicit
  }

  const itemType = String(benefit?.item_type || '').toLowerCase()
  const couponType = String(
    benefit?.coupon_type || benefit?.product_type || ''
  ).toLowerCase()
  const discountType = String(benefit?.discount_type || '').toLowerCase()

  if (itemType === 'physical') return 'physical_delivery'

  if (
    discountType === 'free_order' ||
    couponType.includes('exchange') ||
    couponType.includes('gift') ||
    couponType.includes('product')
  ) {
    return 'product_exchange'
  }

  if (
    discountType === 'free_time' ||
    discountType === 'free_minutes' ||
    discountType === 'fixed' ||
    discountType === 'fixed_off' ||
    discountType === 'percent' ||
    discountType === 'percentage_off'
  ) {
    return 'charge_scan'
  }

  return 'benefit_detail'
}

export function buildOwnedBenefitDetailPath(item: any) {
  if (!item?.product_id) return '/mine?tab=benefit'
  const params = new URLSearchParams({ owned: '1' })
  if (item.user_product_id) params.set('up', String(item.user_product_id))
  return `/coupon/${item.product_id}?${params.toString()}`
}

export function getBenefitPrimaryAction({
  benefit,
  status,
  language,
  couponId,
  userProductId,
}: {
  benefit?: any
  status?: string
  language: AppLanguage
  couponId?: string
  userProductId?: string
}) {
  const currentStatus = String(status || benefit?.status || 'available')
  const actionType = resolveBenefitActionType(benefit)
  const resolvedCouponId = couponId || benefit?.product_id || benefit?.id || ''
  const linkedMallItemId = String(benefit?.linked_mall_item_id || '').trim()
  const ownedCouponParams = new URLSearchParams()
  if (resolvedCouponId) ownedCouponParams.set('coupon_id', resolvedCouponId)
  if (userProductId || benefit?.user_product_id) {
    ownedCouponParams.set('up', String(userProductId || benefit?.user_product_id))
  }
  ownedCouponParams.set('coupon_owned', '1')

  if (currentStatus === 'used') {
    return {
      type: actionType,
      disabled: true,
      route: '',
      label: pickText(language, {
        zh: '已使用',
        th: 'ใช้แล้ว',
        en: 'Used',
      }),
    }
  }

  if (currentStatus === 'expired') {
    return {
      type: actionType,
      disabled: true,
      route: '',
      label: pickText(language, {
        zh: '已过期',
        th: 'หมดอายุ',
        en: 'Expired',
      }),
    }
  }

  switch (actionType) {
    case 'charge_scan':
      return {
        type: actionType,
        disabled: false,
        route: `/benefit/use/charge${resolvedCouponId ? `?coupon_id=${encodeURIComponent(resolvedCouponId)}` : ''}`,
        label: pickText(language, {
          zh: '去扫码充电',
          th: 'ไปสแกนชาร์จ',
          en: 'Scan to Charge',
        }),
      }
    case 'product_exchange':
      return {
        type: actionType,
        disabled: false,
        route: linkedMallItemId
          ? `/redeem/${linkedMallItemId}?${ownedCouponParams.toString()}`
          : `/benefit/use/exchange${resolvedCouponId ? `?coupon_id=${encodeURIComponent(resolvedCouponId)}` : ''}`,
        label: pickText(language, {
          zh: '去商品兑换',
          th: 'ไปหน้าแลกสินค้า',
          en: 'Go to Exchange',
        }),
      }
    case 'physical_delivery':
      return {
        type: actionType,
        disabled: false,
        route: '/mine?tab=benefit',
        label: pickText(language, {
          zh: '查看领取信息',
          th: 'ดูข้อมูลการรับสิทธิ์',
          en: 'View Claim Info',
        }),
      }
    default:
      return {
        type: actionType,
        disabled: false,
        route: '/mine?tab=benefit',
        label: pickText(language, {
          zh: '查看权益说明',
          th: 'ดูรายละเอียดสิทธิ์',
          en: 'View Benefit Info',
        }),
      }
  }
}
