// Üyelik satın alma (telefon uygulamasında RevenueCat; Google Play, ileride App Store).
// Satın alma sonrası sunucu RevenueCat kaydını okuyup hesabın erişimini günceller (server/billing.js).

import { Purchases } from '@revenuecat/purchases-capacitor'
import { apiFetch } from './api'
import { isNative } from './platform'

const API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_KEY

export const canPurchase = isNative && Boolean(API_KEY)

// Web'de gösterilen fiyatlar. Mağazadaki (Play Console / RevenueCat) fiyatlarla aynı olmalı;
// uygulamada her zaman mağazanın kendi fiyat metni gösterilir.
export const LISTED_PRICES = { yearly: '699,99 ₺', monthly: '99,99 ₺', lifetime: '1.499,99 ₺' }

let configuredFor = null

/** Giriş yapılınca: RevenueCat'teki müşteri = Supabase kullanıcısı */
export async function startBilling(userId) {
  if (!canPurchase || !userId) return
  if (configuredFor === null) {
    await Purchases.configure({ apiKey: API_KEY, appUserID: userId })
  } else if (configuredFor !== userId) {
    await Purchases.logIn({ appUserID: userId })
  }
  configuredFor = userId
}

/** Çıkışta: bu cihazdaki RevenueCat oturumu kapanır */
export async function stopBilling() {
  if (!canPurchase || configuredFor === null) return
  await Purchases.logOut().catch(() => {})
  configuredFor = null
}

const KINDS = { ANNUAL: 'yearly', MONTHLY: 'monthly', LIFETIME: 'lifetime' }

/**
 * Mağazadaki üyelik seçenekleri: yıllık, aylık, ömür boyu (bu sırayla).
 * Fiyat metinleri mağazadan gelir (para birimi ve vergi dahil).
 */
export async function getPlans() {
  const offerings = await Purchases.getOfferings()
  const packages = offerings?.current?.availablePackages || []
  const plans = packages
    .filter((p) => KINDS[p.packageType])
    .map((p) => ({ kind: KINDS[p.packageType], pkg: p, price: p.product.price, priceString: p.product.priceString, currency: p.product.currencyCode }))
  const order = ['yearly', 'monthly', 'lifetime']
  return plans.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
}

const isCancelled = (error) =>
  error?.userCancelled === true || error?.code === '1' || error?.code === 1 || /cancel/i.test(error?.message || '')

/** Sunucudan hesabın üyeliğini RevenueCat ile eşitlemesini ister */
export async function syncMembership() {
  const response = await apiFetch('/api/purchases/sync', { method: 'POST' })
  if (!response.ok) throw new Error(`${response.status}`)
  return response.json()
}

/** Satın alır; kullanıcı vazgeçerse { cancelled: true } döner */
export async function buyPlan(plan) {
  try {
    await Purchases.purchasePackage({ aPackage: plan.pkg })
  } catch (error) {
    if (isCancelled(error)) return { cancelled: true }
    throw error
  }
  return { membership: await syncMembership() }
}

/** Daha önce (ör. başka telefonda) yapılmış satın alımları bu hesaba geri yükler */
export async function restorePurchases() {
  await Purchases.restorePurchases()
  return syncMembership()
}
