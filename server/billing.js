// Üyelik ödemeleri: RevenueCat (Google Play, ileride App Store ve web).
//
// Satın alma uygulamada RevenueCat SDK ile yapılır; uygulama kullanıcısı = Supabase kullanıcı kimliği.
// Sunucu, RevenueCat'in müşteri kaydını (REST API) okuyup hesabın erişimini günceller:
//   - satın alımdan hemen sonra uygulamanın isteğiyle (POST /api/purchases/sync)
//   - yenileme, iptal, süre bitimi gibi olaylarda RevenueCat webhook'u ile
// Erişim yalnızca burada yazılır (profiles: access_until, subscription_status, plan, renews…).

import { forgetProfile, supabaseAdmin as db } from './userAuth.js'

const ENTITLEMENT = 'premium'
// Ömür boyu üyelikte erişim bitişi (pratikte süresiz)
const LIFETIME_UNTIL = '9999-12-31T00:00:00.000Z'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const billingAvailable = () => Boolean(process.env.REVENUECAT_SECRET_KEY)

async function fetchSubscriber(userId) {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}`, 'Content-Type': 'application/json' }
  })
  if (!response.ok) throw new Error(`RevenueCat ${response.status}`)
  return (await response.json()).subscriber
}

const planOf = (productId, lifetime) => {
  if (lifetime) return 'lifetime'
  return /year|annual/i.test(productId || '') ? 'yearly' : 'monthly'
}

/**
 * RevenueCat kaydına göre hesabın erişimini günceller ve yeni üyelik bilgisini döndürür.
 * Test (sandbox) satın alımları yalnızca ALLOW_SANDBOX_PURCHASES=true iken erişim verir.
 */
export async function syncMembership(userId) {
  if (!UUID.test(userId)) return null
  const [subscriber, { data: profile, error }] = await Promise.all([
    fetchSubscriber(userId),
    db.from('profiles').select('trial_ends_at').eq('id', userId).maybeSingle()
  ])
  if (error) throw error
  if (!profile) return null

  const now = Date.now()
  const trialEnds = new Date(profile.trial_ends_at).getTime()
  // Yetki kimliği RevenueCat panelinde belirlenir ("premium" ya da kurulum sihirbazının önerdiği ad);
  // uygulamada tek bir ücretli yetki var, o yüzden adı ne olursa olsun o kullanılır
  const entitlements = subscriber?.entitlements || {}
  const entitlement = entitlements[ENTITLEMENT] || Object.values(entitlements)[0]
  const productId = entitlement?.product_identifier
  const subscription = productId ? subscriber.subscriptions?.[productId] : null
  const purchases = productId ? subscriber.non_subscriptions?.[productId] || [] : []
  const sandbox = Boolean(subscription?.is_sandbox ?? (purchases.length && purchases.every((p) => p.is_sandbox)))
  const counts = entitlement && (!sandbox || process.env.ALLOW_SANDBOX_PURCHASES === 'true')

  let paidUntil = null
  let lifetime = false
  if (counts) {
    lifetime = entitlement.expires_date === null
    // Ödeme sorununda mağazanın tanıdığı ek süre (grace period) boyunca erişim sürer
    const until = entitlement.grace_period_expires_date || entitlement.expires_date
    paidUntil = lifetime ? new Date(LIFETIME_UNTIL).getTime() : new Date(until).getTime()
  }
  const paidActive = paidUntil !== null && paidUntil > now

  const update = {
    access_until: new Date(Math.max(trialEnds, paidUntil || 0)).toISOString(),
    subscription_status: paidActive ? 'active' : trialEnds > now ? 'trial' : 'expired',
    plan: paidActive ? planOf(productId, lifetime) : null,
    renews: Boolean(paidActive && !lifetime && subscription && !subscription.unsubscribe_detected_at),
    billing_issue: Boolean(paidActive && subscription?.billing_issues_detected_at),
    management_url: paidActive && !lifetime ? subscriber.management_url || null : null,
    // Abonelik döneminin gerçek bitişi (ömür boyu ya da ücretli üyelik yoksa null)
    period_ends_at: paidActive && !lifetime ? new Date(paidUntil).toISOString() : null
  }
  const { error: updateError } = await db.from('profiles').update(update).eq('id', userId)
  if (updateError) throw updateError
  forgetProfile(userId)
  return update
}

/** RevenueCat webhook olayındaki kullanıcı kimlikleri (aktarım ve takma adlar dahil) */
export function webhookUserIds(event) {
  const ids = [event?.app_user_id, event?.original_app_user_id, ...(event?.aliases || []), ...(event?.transferred_to || []), ...(event?.transferred_from || [])]
  return [...new Set(ids.filter((id) => typeof id === 'string' && UUID.test(id)))]
}
