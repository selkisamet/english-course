import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import page from '../styles/page.module.css'
import styles from './Legal.module.css'

// UYARI: Bu metinler şablondur. Satışa çıkmadan önce bir hukukçuya inceletilmeli ve
// veri sorumlusunun (işletmenin) unvanı, adresi ve iletişim bilgileri eklenmelidir.

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || 'iletişim adresi'

const PRIVACY = {
  title: 'Gizlilik Politikası',
  sections: [
    ['Topladığımız veriler', [
      'Hesap bilgileri: e-posta adresin, (Google ile giriş yaptıysan) Google hesabındaki adın ve belirlediğin görünen ad.',
      'Öğrenme verileri: kaydettiğin kelimeler, tekrar geçmişin, okuduğun hikayeler ve uygulama tercihlerin.',
      'Şifre ile giriş yapıyorsan şifren yalnızca geri döndürülemez biçimde (özetlenerek) saklanır; biz göremeyiz.'
    ]],
    ['Verileri neden kullanıyoruz', [
      'Hesabını oluşturmak, giriş yapmanı sağlamak ve deneme/abonelik süreni yönetmek.',
      'İlerlemeni farklı cihazlarında eşitlemek ve sana kişisel tekrar planı sunmak.',
      'Verilerini reklam amacıyla kullanmıyor ve satmıyoruz.'
    ]],
    ['Hizmet sağlayıcılar', [
      'Supabase: hesap ve öğrenme verilerinin saklandığı veritabanı ve giriş altyapısı.',
      'Render: uygulamanın barındırıldığı sunucu.',
      'Google: yalnızca "Google ile devam et" seçeneğini kullanırsan kimlik doğrulama için.',
      'DeepL: işaretlemesi olmayan hikayelerde kelime ve cümle çevirisi için yalnızca hikaye metni gönderilir; kişisel veri gönderilmez.'
    ]],
    ['Haklarım', [
      '6698 sayılı KVKK kapsamında verilerine erişme, düzeltilmesini ve silinmesini isteme haklarına sahipsin.',
      'Hesabını ve bütün verilerini "Hesabım" sayfasındaki "Hesabımı sil" düğmesiyle istediğin an kalıcı olarak silebilirsin.',
      `Diğer talepler için bize ${CONTACT} üzerinden ulaşabilirsin.`
    ]]
  ]
}

const TERMS = {
  title: 'Kullanım Koşulları',
  sections: [
    ['Hesap', [
      'Uygulamayı kullanmak için bir hesap oluşturman gerekir. Hesap bilgilerinin güvenliğinden sen sorumlusun.',
      'Hesabını başkalarıyla paylaşmamalısın.'
    ]],
    ['Deneme süresi ve abonelik', [
      'Yeni hesaplar ücretsiz bir deneme süresiyle başlar. Deneme süresi bitince içeriklere erişim için abonelik gerekir.',
      'Deneme ya da abonelik sona erdiğinde hesabın ve ilerlemen silinmez; aboneliğini başlattığında kaldığın yerden devam edersin.'
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
      {doc.sections.map(([heading, items]) => (
        <section key={heading}>
          <h2>{heading}</h2>
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted">
        <Link to={type === 'privacy' ? '/kosullar' : '/gizlilik'}>
          {type === 'privacy' ? 'Kullanım Koşulları' : 'Gizlilik Politikası'}
        </Link>
      </p>
    </div>
  )
}

export default Legal
