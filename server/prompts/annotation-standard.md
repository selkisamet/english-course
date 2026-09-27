# Hikaye kelime işaretleme standardı

Bu belge, hikayelerdeki her kelimeye tıklandığında öğrenciye gösterilecek bilginin nasıl
hazırlanacağını tanımlar. Hem elle işaretlemede, hem insan incelemesinde, hem de yeni hikayelerin
otomatik işaretlenmesinde (Claude API) aynı kurallar geçerlidir.

Hedef kitle: İngilizce öğrenen Türk öğrenciler (A1–C2). Amaç, kelimenin **temel anlamını** ve
**o cümlede hangi anlamda kullanıldığını** doğru, kısa ve öğretici biçimde göstermektir.
Yanlış bilgi vermek, hiç bilgi vermemekten kötüdür.

## Her kelime için alanlar

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `lemma` | evet | Kelimenin sözlükteki kök hali, küçük harf (özel isimler hariç). *plays → play*, *went → go*, *children → child*, *better → good* (sıfat), *is → be*. |
| `pos` | evet | **Bu cümledeki** tür. Değerler: `noun`, `verb`, `adjective`, `adverb`, `preposition`, `conjunction`, `determiner`, `pronoun`, `number`, `exclamation`, `modal verb`, `auxiliary verb`, `definite article`, `indefinite article`, `infinitive marker`, `proper noun`. |
| `wordId` + `sense` | liste kelimesiyse | Kelime Oxford 3000 listesindeyse: listedeki kimliği ve **bu cümlede kullanılan anlamın** sırası. Temel anlam oradan okunur. Kullanılan anlam listede yoksa en yakın anlam seçilir ve `note` ile açıklanır. |
| `base` | liste dışıysa | Kelime listede yoksa kısa, doğru Türkçe temel anlam. Özel isimlerde "(kişi adı)", "(şehir adı)" gibi. |
| `context` | evet | Kelimenin **bu cümledeki** Türkçe karşılığı. Cümlenin Türkçesinde kelimeye düşen ifade; kısa (1–4 kelime). Türkçede ek olarak karşılanıyorsa ek yazılır: *in* → "-de", *of* → "-in". Türkçede karşılığı yoksa (ör. *the*, soru yapan *do*) "(Türkçede karşılığı yok)" yazılır ve `note` ile işlevi açıklanır. |
| `note` | gerekirse | Tek-iki cümlelik öğretici açıklama. Yalnızca şu durumlarda yazılır: (1) bağlamsal anlam temel anlamdan belirgin biçimde ayrışıyorsa, (2) Türkçeye çeviri yapısı öğrenciyi şaşırtabilecekse, (3) kelime bir dil bilgisi işlevi taşıyorsa (yardımcı fiil, tanımlık, mastar eki). Her kelimeye not yazılmaz. |
| `form` | gerekirse | Kelime kök halinde değilse biçimin açıklaması: *plays* = "play + -s (geniş zaman, 3. tekil şahıs)", *went* = "go fiilinin geçmiş zamanı", *children* = "child'ın çoğulu", *don't* = "do not'un kısaltması". |
| `phrase` | gerekirse | Kelime, anlamı tek tek kelimelerden çıkarılamayan bir kalıbın parçasıysa: *get up*, *look after*, *a lot of*, *in front of*, *twenty-five years old*. Kalıbın bütün kelimelerinde aynı `phrase` bulunur: kapsadığı kelime aralığı, İngilizce metni ve Türkçe anlamı. |

Her cümle için ayrıca doğal, akıcı ve anlamca tam bir Türkçe çeviri (`sentences[].tr`) yazılır.
Çeviri, `context` alanlarıyla tutarlı olmalıdır.

## Örnekler

**We have a new English teacher.** — *have*
- lemma `have`, pos `verb`, wordId `have`, sense: "sahip olmak" anlamı
- context: "var"
- note: "Sahiplik bildiren *have*, Türkçede çoğu zaman '-(n)in … var' yapısıyla çevrilir: *We have a teacher* → *Bir öğretmenimiz var.*"

**We have dinner together every evening.** — *have*
- sense: "sahip olmak; (yemek) yemek" anlamı, context: "yemek (yemek)"
- note: "*have* yemek ve içecekle kullanıldığında 'yemek, içmek' anlamına gelir: *have breakfast* = kahvaltı yapmak."

**She is reading a book.** — *is*
- lemma `be`, pos `auxiliary verb`, sense: be'nin yardımcı fiil anlamı
- context: "(Türkçede ayrı karşılığı yok)", form: "be fiilinin 3. tekil şahıs, geniş zaman hali"
- note: "*is + -ing* şimdiki zamanı kurar; Türkçede '-yor' ekiyle karşılanır: *is reading* = okuyor."

**My brother plays football.** — *plays*
- lemma `play`, pos `verb`, context: "oynar", form: "play + -s (geniş zaman, 3. tekil şahıs)"

**I get up at seven.** — *get* ve *up*
- phrase: *get up* → "(yataktan) kalkmak"; iki kelimede de aynı phrase.
- *get* için context: "kalkmak (get up)"; ayrıca note gerekmez, phrase anlamı açıklar.

**The book is on the table.** — *the*
- pos `definite article`, context: "(Türkçede karşılığı yok)"
- note yalnızca metinde *the*'nin ilk geçtiği yerde: "*the* belirli bir şeyden söz edildiğini gösterir; Türkçede genellikle karşılığı yoktur."

**My name is John.** — *John*
- lemma `John`, pos `proper noun`, wordId yok, base "(erkek adı)", context "John"

## Kurallar

1. **Bağlam önce gelir.** `sense` ve `context`, kelimenin sözlükteki ilk anlamına göre değil, bu
   cümledeki anlamına göre seçilir.
2. **Kısa ve doğru.** Türkçe ifadeler doğal olmalı, İngilizceden kelime kelime çevrilmemeli.
3. **Tutarlılık.** Aynı kelime aynı anlamda tekrar geçiyorsa aynı işaretlemeyi alır; not yalnızca
   ilk geçişte yazılır.
4. **Emin değilsen not düş, uydurma.** Belirsiz bir durumda kesin olmayan bilgi vermek yerine en
   yaygın ve güvenli açıklama seçilir.
5. **Noktalama işaretleri** kelimeye aittir ama işaretlemeyi etkilemez (*John.* → John).
6. **Sayılar** (`twenty-five`, `6:30`) `number` olarak işaretlenir, context sayının Türkçesidir.
