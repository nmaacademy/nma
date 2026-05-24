<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Avertizare securitate cont</title>
    <style>
        body { margin: 0; padding: 0; background: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .wrapper { max-width: 480px; margin: 40px auto; background: #18181f; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 32px 40px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .logo { font-size: 20px; font-weight: 900; color: #8b5cf6; letter-spacing: -0.5px; }
        .alert-bar { background: rgba(239,68,68,0.1); border-left: 3px solid #ef4444; padding: 14px 40px; }
        .alert-text { color: #fca5a5; font-size: 13px; font-weight: 600; margin: 0; letter-spacing: 0.3px; }
        .body { padding: 32px 40px; }
        .greeting { color: #e5e5ea; font-size: 16px; margin: 0 0 16px; }
        .description { color: #8e8e99; font-size: 14px; line-height: 1.7; margin: 0 0 24px; }
        .info-box { background: #0f0f13; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .info-row:last-child { margin-bottom: 0; }
        .info-label { color: #5c5c6b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; }
        .info-value { color: #e5e5ea; font-size: 13px; font-weight: 600; }
        .strike-warning { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; }
        .strike-text { color: #fca5a5; font-size: 13px; line-height: 1.6; margin: 0; }
        .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 28px 0; }
        .disclaimer { color: #5c5c6b; font-size: 12px; line-height: 1.6; margin: 0; }
        .footer { background: #111116; padding: 20px 40px; text-align: center; }
        .footer-text { color: #3d3d4d; font-size: 12px; margin: 0; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="header">
            <div class="logo">NMA</div>
        </div>

        <div class="alert-bar">
            <p class="alert-text">⚠ Avertizare de securitate — Acțiune necesară</p>
        </div>

        <div class="body">
            <p class="greeting">Bună, {{ $userName }}!</p>

            <p class="description">
                Am detectat că contul tău NMA Academy a fost accesat simultan de pe <strong style="color:#e5e5ea">mai multe dispozitive</strong>.
                Redarea video activă a fost întreruptă pe dispozitivul mai vechi pentru a proteja conținutul.
            </p>

            <div class="info-box">
                <div class="info-row">
                    <span class="info-label">Detectat la</span>
                    <span class="info-value">{{ $detectedAt }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Număr avertizări</span>
                    <span class="info-value" style="color: #f87171;">{{ $strikeCount }} / 3</span>
                </div>
            </div>

            @if($strikeCount >= 2)
            <div class="strike-warning">
                <p class="strike-text">
                    <strong>Atenție:</strong> Ai acumulat {{ $strikeCount }} avertizări.
                    La 3 avertizări contul tău poate fi suspendat temporar.
                    Dacă nu tu ai inițiat aceste sesiuni, te rugăm să îți schimbi parola imediat.
                </p>
            </div>
            @endif

            <p class="description">
                Dacă <strong style="color:#e5e5ea">tu</strong> ai deschis cursul pe un alt dispozitiv, poți ignora acest mesaj.
                Dacă <strong style="color:#e5e5ea">nu</strong> recunoști această activitate, schimbă-ți parola și revocă sesiunile active din setările contului.
            </p>

            <hr class="divider">

            <p class="disclaimer">
                NMA Academy permite utilizarea unui singur dispozitiv activ simultan.
                Distribuirea accesului la cont încalcă Termenii și Condițiile platformei.
            </p>
        </div>

        <div class="footer">
            <p class="footer-text">© {{ date('Y') }} NMA Academy. Toate drepturile rezervate.</p>
        </div>
    </div>
</body>
</html>
