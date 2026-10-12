import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import page from '../styles/page.module.css'
import styles from './Legal.module.css'

// UYARI: Bu metinler uygulamanın gerçek veri akışına göre yazıldı, ancak satışa çıkmadan önce bir
// hukukçuya inceletilmeli. Veri sorumlusunun unvanı ve adresi (şirket kurulunca) VITE_LEGAL_NAME ve
// VITE_LEGAL_ADDRESS ile, iletişim adresi VITE_CONTACT_EMAIL ile verilir (Render ve .env.local).
// Veri akışı değişirse (yeni bir hizmet, yeni bir veri) bu metin de güncellenmeli.

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL
const LEGAL_NAME = import.meta.env.VITE_LEGAL_NAME
const LEGAL_ADDRESS = import.meta.env.VITE_LEGAL_ADDRESS

const PRIVACY_UPDATED = '12 Ekim 2026'

const PRIVACY = {
  title: 'Gizlilik Politikası',
  updated: PRIVACY_UPDATED,
  sections: [
    ['Veri sorumlusu', [
      LEGAL_NAME && `Bu uygulamanın veri sorumlusu: ${LEGAL_NAME}${LEGAL_ADDRESS ? `, ${LEGAL_ADDRESS}` : ''}.`,
      CONTACT && `Kişisel verilerinle ilgili her soru ve talep için: ${CONTACT}`
    ]],
    ['Topladığımız veriler', [
      'Hesap bilgileri: e-posta adresin, belirlediğin görünen ad ve giriş yöntemin (e-posta kodu, şifre ya da Google). Google ile giriş yaptıysan Google hesabındaki adın da alınır.',
      'Şifreyle giriş yapıyorsan şifren yalnızca geri döndürülemez biçimde (özetlenerek) saklanır; biz göremeyiz.',
      'Öğrenme verileri: kaydettiğin ve çalıştığın kelimeler, tekrar geçmişin ve bir sonraki tekrar tarihleri, okuduğun hikayeler, günlük çalışma özetlerin (cevap ve doğru cevap sayısı, öğrenilen yeni kelime ve okunan hikaye sayısı) ve uygulama tercihlerin (seviye, günlük yeni kelime hedefi gibi).',
      'Hatırlatma ayarların: telefon bildirimi ve e-posta hatırlatmasının açık olup olmadığı, hatırlatma saatin, saat dilimin, seri kurtarma tercihin ve son hatırlatmanın gönderildiği gün.',
      'Bildirim kimliği: telefon bildirimini açarsan, bildirimlerin telefonuna ulaşması için telefonuna özgü bir kimlik saklanır. Telefon numaran, rehberin, konumun ya da cihazındaki başka veriler alınmaz.',
      'Üyelik bilgileri: satın aldığın üyelik türü (aylık, yıllık ya da ömür boyu), üyeliğinin bitiş ve yenilenme durumu ve mağazanın bildirdiği ödeme sorunları. Kart bilgilerin bize ulaşmaz; ödemeyi Google Play alır.',
      'Teknik bilgiler: uygulama sunucularımıza bağlanırken IP adresin gibi bilgiler, barındırma sağlayıcılarımızın kayıtlarında kısa süre tutulabilir.'
    ]],
    ['Cihazında saklananlar', [
      'İlerlemen ve tercihlerin, çevrimdışı da kullanabilmen için cihazında (tarayıcının ya da uygulamanın yerel depolamasında) da tutulur. Açtığın hikayeler ve kelimeler çevrimdışı kullanım için önbelleğe alınır.',
      'Çıkış yaptığında cihazındaki ilerlemen ve bu cihazın bildirim kimliği silinir; ilerlemen hesabında kalır.',
      'Çerez, reklam ya da kullanım analizi aracı kullanmıyoruz.'
    ]],
    ['Verileri neden kullanıyoruz', [
      'Hesabını oluşturmak, giriş yapmanı sağlamak ve deneme ya da abonelik süreni yönetmek.',
      'İlerlemeni cihazların arasında eşitlemek, sana kişisel tekrar planı ve ilerleme istatistikleri sunmak.',
      'Yalnızca açtıysan günlük hatırlatma göndermek. Hatırlatmanın metni (tekrar bekleyen kelime sayısı, serin, sıradaki hikaye gibi) gönderim anında ilerleme verilerinden hesaplanır.',
      'Verilerini reklam amacıyla kullanmıyor, kimseyle paylaşıp satmıyoruz.'
    ]],
    ['Bildirimler ve e-postalar', [
      'Günlük hatırlatmalar yalnızca "Hesabım › Günlük hatırlatma" bölümünden açarsan gönderilir; o gün zaten çalıştıysan gönderilmez. Bir haftadır çalışmadıysan bir kez bilgi verip hatırlatmalara ara veririz.',
      'Telefon bildirimini, seri kurtarma bildirimini ve e-posta hatırlatmasını aynı bölümden istediğin an kapatabilirsin. Telefonunun ayarlarından da bu uygulamanın bildirimlerini kapatabilirsin.',
      'Giriş kodları, e-posta doğrulama ve şifre yenileme e-postaları hesabının çalışması için gereklidir ve hatırlatma ayarlarından bağımsızdır.'
    ]],
    ['Hizmet sağlayıcılar', [
      'Supabase: hesap, öğrenme ve hatırlatma verilerinin saklandığı veritabanı ve giriş altyapısı; hikaye ve kelime seslendirmeleri de buradan indirilir.',
      'Render: uygulamanın ve sunucusunun barındırıldığı hizmet.',
      'Google: "Google ile devam et" seçeneğini kullanırsan kimlik doğrulama; telefon bildirimini açtıysan bildirim kimliği ve bildirim metni ile bildirimlerin iletilmesi (Firebase Cloud Messaging); uygulamanın yazı tiplerinin yüklenmesi (Google Fonts, bu sırada IP adresin Google’a ulaşır).',
      'Resend: e-posta adresine giriş kodu, doğrulama ve şifre yenileme e-postalarının, e-posta hatırlatmasını açtıysan hatırlatmaların gönderilmesi.',
      'Google Play: uygulamadan üyelik satın alırsan ödemeyi Google alır ve kendi gizlilik politikasına göre işler.',
      'RevenueCat: uygulamadan yapılan satın alımları doğrulamak ve üyeliğini hesabına işlemek için hesap kimliğin ve satın alma kayıtların (ürün, tarih, yenilenme durumu) işlenir.',
      'DeepL: işaretlemesi olmayan hikayelerde çeviri için yalnızca hikaye metni ve cümleleri gönderilir; kişisel veri gönderilmez.',
      'Cihazının seslendirme özelliği: seslendirmesi hazır olmayan kelime ve cümleler cihazının ya da tarayıcının kendi seslendirmesiyle okunur. Bazı tarayıcılar bu metni kendi sunucularında işleyebilir; gönderilen yalnızca İngilizce kelime ya da cümledir.',
      'Bu sağlayıcıların sunucuları Türkiye dışında bulunabilir. Verilerin yalnızca yukarıdaki amaçlar için ve gerektiği kadar aktarılır.'
    ]],
    ['Saklama süresi', [
      'Verilerini hesabın açık olduğu sürece saklarız.',
      'Hesabını sildiğinde hesap bilgilerin, öğrenme verilerin, hatırlatma ayarların ve bildirim kimliklerin kalıcı olarak silinir.',
      'Daha önce gönderilmiş e-postaların teslim kayıtları, e-posta sağlayıcısında kendi saklama süresi boyunca kalabilir.',
      'Satın alma kayıtları Google Play ve RevenueCat’te tutulur; yasal yükümlülükler (ör. vergi mevzuatı) gerektirdiği süre boyunca, hesabın silinse de saklanabilir.'
    ]],
    ['Hakların', [
      '6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında verilerinin işlenip işlenmediğini öğrenme, bunlara erişme, düzeltilmesini ve silinmesini isteme haklarına sahipsin.',
      'Hesabını ve bütün verilerini "Hesabım" sayfasındaki "Hesabımı sil" düğmesiyle istediğin an kalıcı olarak silebilirsin.',
      CONTACT && `Diğer talepler için bize ${CONTACT} adresinden ulaşabilirsin.`
    ]],
    ['Değişiklikler', [
      'Bu politika güncellenebilir. Güncel hali her zaman bu sayfadadır; önemli değişiklikleri uygulama içinde duyururuz.'
    ]]
  ]
}

const TERMS = {
  title: 'Kullanım Koşulları',
  updated: PRIVACY_UPDATED,
  sections: [
    ['Hesap', [
      'Uygulamayı kullanmak için bir hesap oluşturman gerekir. Hesap bilgilerinin güvenliğinden sen sorumlusun.',
      'Hesabını başkalarıyla paylaşmamalısın.'
    ]],
    ['Deneme süresi ve üyelik', [
      'Yeni hesaplar ücretsiz bir deneme süresiyle başlar; deneme için ödeme bilgisi istenmez. Deneme bitince içeriklere erişim için üyelik gerekir.',
      'Üyelik seçenekleri: aylık ve yıllık abonelik ile tek seferlik ömür boyu üyelik. Güncel fiyatlar satın alma ekranında, vergiler dahil gösterilir.',
      'Uygulamadan yapılan satın alımlarda ödemeyi Google Play alır ve ücret satın alma anında tahsil edilir.',
      'Abonelikler, dönem bitmeden iptal edilmezse aynı süre için otomatik yenilenir. Aboneliğini Google Play’in abonelikler bölümünden istediğin an iptal edebilirsin; iptal ettiğinde ödenmiş dönemin sonuna kadar erişimin sürer.',
      'Ömür boyu üyelik tek seferlik ödemedir; yenilenmez ve ek ücret alınmaz. Uygulama yayında kaldığı sürece hesabına bağlı olarak geçerlidir.',
      'İade talepleri Google Play’in iade kurallarına göre Google Play üzerinden yapılır.',
      'Üyelik hesabına bağlıdır; aynı hesapla giriş yaptığın her cihazda (telefon ve web) geçerlidir.',
      'Deneme ya da üyelik sona erdiğinde hesabın ve ilerlemen silinmez; üyeliğini başlattığında kaldığın yerden devam edersin.'
    ]],
    ['İçerik', [
      'Hikayeler, kelime açıklamaları ve çeviriler eğitim amaçlıdır ve özenle hazırlanır. Bir hata fark edersen bize bildirmeni rica ederiz.',
      'İçerikler kişisel kullanım içindir; izinsiz kopyalanamaz ve dağıtılamaz.'
    ]],
    ['Değişiklikler', [
      'Bu koşullar güncellenebilir. Önemli değişiklikleri uygulama içinde duyururuz.'
    ]]
  ]
}

function Legal({ type }) {
  const navigate = useNavigate()
  const doc = type === 'privacy' ? PRIVACY : TERMS

  return (
    <div className={`${page.page} ${styles.legal}`}>
      <button type="button" className={page.backLink} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        <ArrowLeft size={18} /> Geri
      </button>
      <h1 className={page.title}>{doc.title}</h1>
      {doc.updated && <p className="muted">Son güncelleme: {doc.updated}</p>}
      {doc.sections.map(([heading, items]) => {
        // Ayarlanmamış bilgiler (ör. henüz şirket unvanı yok) metne yer tutucu olarak girmez
        const lines = items.filter(Boolean)
        if (!lines.length) return null
        return (
          <section key={heading}>
            <h2>{heading}</h2>
            <ul>
              {lines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )
      })}
      <p className="muted">
        <Link to={type === 'privacy' ? '/kosullar' : '/gizlilik'}>
          {type === 'privacy' ? 'Kullanım Koşulları' : 'Gizlilik Politikası'}
        </Link>
      </p>
    </div>
  )
}

export default Legal
