# Order Log

Tedarikçi fişlerini fotoğraftan okuyup aranabilir fiyat geçmişine çeviren uygulama.
Next.js + Supabase (veritabanı, giriş, fotoğraf) + Claude API (fiş okuma ve sohbet). Vercel'de yayınlanır.

## Kurulum (bir kere, tamamı tarayıcıdan)

1. **GitHub**: Yeni bir repo aç, bu klasördeki dosyaları yükle.
2. **Supabase** (supabase.com): Yeni proje aç.
   - SQL Editor'da `supabase/schema.sql` dosyasının içeriğini yapıştırıp çalıştır.
   - Authentication ayarlarında yeni kullanıcı kaydını kapat. Böylece sadece senin davet ettiklerin girebilir.
   - Project Settings > API'den şunları kopyala: Project URL, anon key, service_role key.
3. **Anthropic** (console.anthropic.com): API key oluştur ve biraz kredi yükle.
4. **Vercel** (vercel.com): GitHub reposunu import et. Environment Variables kısmına
   `.env.example` içindeki 5 değişkeni gir, ardından Deploy'a bas.
5. **Supabase'e geri dön**: Authentication > URL Configuration'da Site URL alanına Vercel adresini yaz.
6. **Ekibi davet et**: Authentication > Users > Invite user. Her manager'ın e-postasını ekle.
   Maile gelen linkle giriş yapıp adını ve restoranını seçerler.

## Notlar
- `service_role` key ve `ANTHROPIC_API_KEY` sadece Vercel'de durur, tarayıcıya hiç gitmez.
- Fiş okuma bir fiş için genelde 15-40 saniye sürer. `maxDuration` 60 saniyeye ayarlı.
- Model `ANTHROPIC_MODEL` değişkeniyle değiştirilebilir.
