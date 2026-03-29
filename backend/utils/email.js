const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const service = process.env.EMAIL_SERVICE || 'gmail';
  const user    = process.env.EMAIL_USER;
  const pass    = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn('[Email] EMAIL_USER / EMAIL_PASS 환경변수가 없습니다. 이메일 발송이 비활성화됩니다.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * 공연 알림 이메일 발송
 */
async function sendNotificationEmail({ to, userName, concert, daysLeft }) {
  const t = getTransporter();
  if (!t) return false;

  const dateStr = new Date(concert.concert_date + 'T00:00:00')
    .toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const daysLabel =
    daysLeft === 0 ? '오늘' :
    daysLeft === 1 ? '내일' :
    `${daysLeft}일 후`;

  const subject = `🎵 [ClassicTour] ${daysLabel} 공연이 있어요 — ${concert.venue_name}`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Apple SD Gothic Neo',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;
                  width:56px;height:56px;background:rgba(245,200,66,0.12);
                  border-radius:50%;border:1px solid rgba(245,200,66,0.3);margin-bottom:12px;">
        <span style="font-size:24px;">🎵</span>
      </div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;letter-spacing:-0.3px;">ClassicTour</h1>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:4px 0 0;">공연 알림</p>
    </div>

    <!-- Card -->
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
                border-radius:16px;overflow:hidden;">

      ${concert.venue_photo_url ? `
      <div style="height:180px;overflow:hidden;">
        <img src="${concert.venue_photo_url}" alt="${concert.venue_name}"
             style="width:100%;height:100%;object-fit:cover;" />
      </div>` : ''}

      <div style="padding:24px;">
        <!-- Days badge -->
        <div style="display:inline-block;background:#f5c842;color:#0a0e1a;
                    font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;
                    margin-bottom:16px;letter-spacing:0.3px;">
          📅 ${daysLabel} 공연
        </div>

        <h2 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px;line-height:1.3;">
          ${concert.venue_name}
        </h2>
        <p style="color:#f5c842;font-size:14px;margin:0 0 16px;">${dateStr}${concert.concert_time ? ' · ' + concert.concert_time : ''}</p>

        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;space-y:8px;">
          <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 6px;">
            🎹 <strong style="color:rgba(255,255,255,0.85);">${concert.musician_name_ko || concert.musician_name}</strong>
          </p>
          ${concert.venue_address ? `<p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 6px;">📍 ${concert.venue_address}</p>` : ''}
          ${concert.venue_city ? `<p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">🌍 ${concert.venue_city}${concert.venue_country ? ', ' + concert.venue_country : ''}</p>` : ''}
        </div>

        ${concert.program && concert.program.length > 0 ? `
        <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:14px;margin-top:16px;">
          <p style="color:rgba(255,255,255,0.3);font-size:11px;text-transform:uppercase;
                    letter-spacing:1px;margin:0 0 8px;">연주 곡목</p>
          ${concert.program.slice(0, 3).map(p =>
            `<p style="color:rgba(255,255,255,0.65);font-size:13px;margin:0 0 4px;">♩ ${p}</p>`
          ).join('')}
        </div>` : ''}

        ${concert.ticket_url ? `
        <div style="text-align:center;margin-top:20px;">
          <a href="${concert.ticket_url}" target="_blank"
             style="display:inline-block;background:#f5c842;color:#0a0e1a;
                    font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;
                    text-decoration:none;letter-spacing:0.2px;">
            티켓 구매 / 공식 사이트 →
          </a>
        </div>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <p style="text-align:center;color:rgba(255,255,255,0.2);font-size:12px;margin-top:24px;">
      ${userName}님의 즐겨찾기 공연 알림입니다.<br>
      ClassicTour에서 알림 설정을 변경할 수 있습니다.
    </p>
  </div>
</body>
</html>`;

  try {
    await t.sendMail({
      from: `"ClassicTour 🎵" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] 알림 발송 완료 → ${to} (${concert.venue_name})`);
    return true;
  } catch (err) {
    console.error(`[Email] 발송 실패 → ${to}:`, err.message);
    return false;
  }
}

module.exports = { sendNotificationEmail };
