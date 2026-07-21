import hashlib
import hmac
import logging
import io
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
import aiosmtplib
import openpyxl
from sqlalchemy import select, or_, func
from app.db import async_session
from app.models import User, Opportunity, EmailLog
from app.config import settings

logger = logging.getLogger(__name__)


def _unsub_url(email: str, type_: str) -> str:
    from urllib.parse import quote
    sig = hmac.new(settings.jwt_secret.encode(), f"{email}:{type_}".encode(), hashlib.sha256).hexdigest()
    return f"{settings.api_url.rstrip('/')}/users/unsubscribe?email={quote(email)}&type={type_}&sig={sig}"


async def send_email_with_attachment(to_email: str, subject: str, text_content: str, html_content: str = None, attachment_name: str = None, attachment_bytes: bytes = None, user_id: int = None, email_type: str = None):
    if not settings.mail_host or not settings.mail_username:
        logger.warning("SMTP not configured. Skipping email to %s", to_email)
        return

    message = EmailMessage()
    message["From"] = f"{settings.mail_from_name} <{settings.mail_from_address}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_content)

    if html_content:
        message.add_alternative(html_content, subtype="html")

    if attachment_name and attachment_bytes:
        message.add_attachment(
            attachment_bytes,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=attachment_name,
        )

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.mail_host,
            port=settings.mail_port,
            username=settings.mail_username,
            password=settings.mail_password,
            use_tls=True if settings.mail_port == 465 else False,
            start_tls=True if settings.mail_port == 587 else False,
        )
        logger.info("Email sent to %s successfully.", to_email)
        
        # Log success
        if user_id and email_type:
            async with async_session() as session:
                log = EmailLog(user_id=user_id, email_type=email_type, status="success")
                session.add(log)
                await session.commit()
                
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        # Log failure
        if user_id and email_type:
            async with async_session() as session:
                log = EmailLog(user_id=user_id, email_type=email_type, status="error", error_message=str(e))
                session.add(log)
                await session.commit()

def generate_excel_attachment(opportunities) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Opportunities"
    
    headers = ["Match Score (%)", "Type", "Title", "Organization", "Location", "Deadline", "URL"]
    ws.append(headers)

    for opp, score in opportunities:
        deadline_str = opp.deadline.strftime("%Y-%m-%d") if opp.deadline else "N/A"
        ws.append([
            score,
            opp.type.capitalize() if opp.type else "Unknown",
            opp.title,
            opp.organization,
            opp.location or "N/A",
            deadline_str,
            opp.url
        ])
    
    # Auto adjust column widths
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter 
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column].width = min(adjusted_width, 50) # Cap at 50

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()

async def send_otp_email(to_email: str, otp: str):
    """Send a 6-digit OTP verification code to a new user."""
    plain = (
        f"Your Opportunity Finder verification code is: {otp}\n"
        "This code expires in 10 minutes. Do not share it with anyone."
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:48px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Verify your email</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Opportunity Finder</p>
    </div>
    <div style="background:#fff;padding:36px 40px;text-align:center;">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        Use the code below to complete your registration. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="display:inline-block;background:#f5f3ff;border:2px dashed #7c3aed;border-radius:12px;padding:18px 40px;">
        <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#4f46e5;">{otp}</span>
      </div>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Opportunity Finder &bull; Do not share this code with anyone.</p>
    </div>
  </div>
</body>
</html>"""
    await send_email_with_attachment(
        to_email=to_email,
        subject="Your verification code",
        text_content=plain,
        html_content=html,
    )


async def send_welcome_email(to_email: str, name: str):
    """Send a welcome email with the full platform guide after successful registration."""
    display_name = name or to_email.split("@")[0]
    plain = f"""Welcome to Opportunity Finder, {display_name}!

Your account is ready. Here's how to get the most out of the platform:

━━━ STEP 1 — BUILD YOUR PROFILE ━━━
Option A: Upload your CV (PDF) on the Profile page.
  AI will automatically extract your skills, education, projects and generate match keywords.
Option B: Manually enter your skills, education and projects on the Profile page, then click
  "Save & Re-rank with AI" — keywords are generated the same way.
Tip: A detailed 1–2 page CV gives the most accurate keyword extraction.

━━━ STEP 2 — MY MATCHES (FOR YOU) ━━━
Your personalised feed shows every active opportunity ranked by AI match score.
  • Score 80%+ → Strong fit — apply with confidence
  • Score 50–79% → Good fit — worth reviewing
  • Score <50% — usually filtered out by default
Use the "Refresh" button after updating your profile to re-run AI ranking with the latest data.
Type pills (Job, Scholarship, Fellowship, Grant, Internship) let you narrow by category.

━━━ STEP 3 — BROWSE ALL ━━━
See every active opportunity regardless of your profile.
Filter by type, location, keyword, deadline. Sort any column.
On mobile the view switches to cards automatically.

━━━ EMAIL ALERTS ━━━
Daily Digest: every morning you receive your Top 20 AI-matched opportunities (+ Excel attachment).
Deadline Alerts: 48-hour warnings for high-match opportunities about to close.

━━━ TIPS ━━━
1. Keep your CV updated — re-upload whenever you add new experience.
2. After editing skills or projects, always hit "Save & Re-rank with AI".
3. Check deadlines directly on opportunity cards — act on high-scoring ones first.
4. Use Browse to discover opportunities outside your current keyword set.
5. Your match score is based on keyword relevance — the more specific your skills, the better.

Visit the platform: {settings.app_url}
Questions? Reply to this email.

– The Opportunity Finder Team
"""
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to Opportunity Finder</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:620px;margin:40px auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.10);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:40px 40px 32px;text-align:center;">
    <div style="display:inline-block;width:52px;height:52px;background:rgba(255,255,255,0.18);border-radius:14px;line-height:52px;font-size:26px;margin-bottom:16px;">🎯</div>
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Welcome to Opportunity Finder!</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,0.82);font-size:14px;">Your AI-powered career discovery platform is ready</p>
  </div>

  <!-- Greeting -->
  <div style="background:#fff;padding:32px 40px 24px;">
    <p style="margin:0;font-size:16px;color:#0f172a;font-weight:700;">Hi {display_name} 👋</p>
    <p style="margin:10px 0 0;font-size:14px;color:#475569;line-height:1.7;">
      Your account is set up and ready to go. This email is your complete guide — bookmark it or read it now to get the best out of the platform.
    </p>
  </div>

  <!-- Divider -->
  <div style="background:#fff;padding:0 40px;"><div style="border-top:1px solid #e2e8f0;"></div></div>

  <!-- Step 1 -->
  <div style="background:#fff;padding:28px 40px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:36px;vertical-align:top;padding-top:2px;">
          <div style="width:28px;height:28px;background:#eef2ff;border-radius:8px;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#4f46e5;">1</div>
        </td>
        <td style="padding-left:14px;">
          <h2 style="margin:0 0 8px;font-size:16px;font-weight:800;color:#0f172a;">Build Your Profile</h2>
          <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.65;">
            The AI needs to know you before it can match you. You have two options:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:8px;">
                <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px 16px;">
                  <div style="font-size:12px;font-weight:800;color:#4f46e5;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">📄 Upload CV (recommended)</div>
                  <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
                    Upload a PDF on your <strong>Profile page</strong>. AI automatically extracts skills, education, projects and generates match keywords.
                  </p>
                </div>
              </td>
              <td style="width:50%;vertical-align:top;padding-left:8px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                  <div style="font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">✍️ Enter Manually</div>
                  <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
                    Type in your skills, education and projects directly. Hit <strong>"Save &amp; Re-rank with AI"</strong> and keywords are generated automatically.
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <p style="margin:12px 0 0;font-size:13px;color:#64748b;background:#f8fafc;border-left:3px solid #4f46e5;padding:10px 12px;border-radius:0 6px 6px 0;">
            💡 <strong>Tip:</strong> A focused 1–2 page CV gives the most accurate keyword extraction. Include project descriptions with tech stack details.
          </p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Divider -->
  <div style="background:#fff;padding:20px 40px 0;"><div style="border-top:1px solid #e2e8f0;"></div></div>

  <!-- Step 2 -->
  <div style="background:#fff;padding:28px 40px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:36px;vertical-align:top;padding-top:2px;">
          <div style="width:28px;height:28px;background:#eef2ff;border-radius:8px;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#4f46e5;">2</div>
        </td>
        <td style="padding-left:14px;">
          <h2 style="margin:0 0 8px;font-size:16px;font-weight:800;color:#0f172a;">My Matches — Your AI-Ranked Feed</h2>
          <p style="margin:0 0 14px;font-size:14px;color:#475569;line-height:1.65;">
            Go to <strong>My Matches</strong> to see every active opportunity ranked by how well it fits your profile.
          </p>
          <!-- Score guide -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
            <tr>
              <td style="width:33%;padding-right:6px;">
                <div style="background:#dcfce7;border-radius:8px;padding:10px 12px;text-align:center;">
                  <div style="font-size:18px;font-weight:900;color:#166534;">80%+</div>
                  <div style="font-size:12px;color:#166534;font-weight:600;margin-top:2px;">Strong fit</div>
                  <div style="font-size:11px;color:#4ade80;margin-top:2px;">Apply now</div>
                </div>
              </td>
              <td style="width:33%;padding:0 3px;">
                <div style="background:#fef3c7;border-radius:8px;padding:10px 12px;text-align:center;">
                  <div style="font-size:18px;font-weight:900;color:#92400e;">50–79%</div>
                  <div style="font-size:12px;color:#92400e;font-weight:600;margin-top:2px;">Good fit</div>
                  <div style="font-size:11px;color:#f59e0b;margin-top:2px;">Worth reviewing</div>
                </div>
              </td>
              <td style="width:33%;padding-left:6px;">
                <div style="background:#fee2e2;border-radius:8px;padding:10px 12px;text-align:center;">
                  <div style="font-size:18px;font-weight:900;color:#991b1b;">&lt;50%</div>
                  <div style="font-size:12px;color:#991b1b;font-weight:600;margin-top:2px;">Weak fit</div>
                  <div style="font-size:11px;color:#f87171;margin-top:2px;">Filtered by default</div>
                </div>
              </td>
            </tr>
          </table>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:2;">
            <li>Filter by <strong>type pill</strong> (Job / Scholarship / Fellowship / Grant / Internship)</li>
            <li>Toggle <strong>"Hide expired"</strong> to remove past-deadline entries</li>
            <li>Click <strong>"Refresh"</strong> to re-run AI ranking with the latest opportunities</li>
            <li>Cached results load instantly — the Refresh button fetches live data</li>
          </ul>
        </td>
      </tr>
    </table>
  </div>

  <!-- Divider -->
  <div style="background:#fff;padding:20px 40px 0;"><div style="border-top:1px solid #e2e8f0;"></div></div>

  <!-- Step 3 -->
  <div style="background:#fff;padding:28px 40px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:36px;vertical-align:top;padding-top:2px;">
          <div style="width:28px;height:28px;background:#eef2ff;border-radius:8px;text-align:center;line-height:28px;font-size:13px;font-weight:800;color:#4f46e5;">3</div>
        </td>
        <td style="padding-left:14px;">
          <h2 style="margin:0 0 8px;font-size:16px;font-weight:800;color:#0f172a;">Browse All Opportunities</h2>
          <p style="margin:0;font-size:14px;color:#475569;line-height:1.65;">
            The <strong>Browse</strong> page shows every active opportunity regardless of your profile. Use it to explore and discover:
          </p>
          <ul style="margin:10px 0 0;padding-left:18px;font-size:13px;color:#475569;line-height:2;">
            <li><strong>Filter</strong> by type, location, organization, or keyword</li>
            <li><strong>Sort</strong> any column — deadline, posted date, title, organization</li>
            <li>Desktop shows a sortable table; mobile shows card layout automatically</li>
            <li>Use Browse to find opportunities outside your current keyword set</li>
          </ul>
        </td>
      </tr>
    </table>
  </div>

  <!-- Divider -->
  <div style="background:#fff;padding:20px 40px 0;"><div style="border-top:1px solid #e2e8f0;"></div></div>

  <!-- Email Alerts -->
  <div style="background:#fff;padding:28px 40px 8px;">
    <h2 style="margin:0 0 12px;font-size:16px;font-weight:800;color:#0f172a;">📬 Email Alerts — Never Miss an Opportunity</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
            <div style="font-size:12px;font-weight:800;color:#4f46e5;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">🌅 Daily Digest</div>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
              Every morning: your <strong>Top 20 AI-matched opportunities</strong> with scores, plus an Excel file with the full details.
            </p>
          </div>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;">
            <div style="font-size:12px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">⚠️ Deadline Alerts</div>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
              Get a <strong>48-hour warning</strong> when a high-match opportunity (50%+) is about to close.
            </p>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Divider -->
  <div style="background:#fff;padding:20px 40px 0;"><div style="border-top:1px solid #e2e8f0;"></div></div>

  <!-- Tips -->
  <div style="background:#fff;padding:28px 40px 24px;">
    <h2 style="margin:0 0 14px;font-size:16px;font-weight:800;color:#0f172a;">🚀 Tips for the Best Results</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;vertical-align:top;width:22px;font-size:15px;">✅</td><td style="padding:6px 0 6px 8px;font-size:13px;color:#475569;line-height:1.6;"><strong>Keep your CV updated.</strong> Re-upload whenever you finish a project, course, or role — AI re-parses automatically.</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;font-size:15px;">✅</td><td style="padding:6px 0 6px 8px;font-size:13px;color:#475569;line-height:1.6;"><strong>After editing skills or projects, always save.</strong> "Save &amp; Re-rank with AI" regenerates your match keywords so the ranking stays accurate.</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;font-size:15px;">✅</td><td style="padding:6px 0 6px 8px;font-size:13px;color:#475569;line-height:1.6;"><strong>Be specific with skills.</strong> "Python" and "machine learning" match more opportunities than broad terms like "programming".</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;font-size:15px;">✅</td><td style="padding:6px 0 6px 8px;font-size:13px;color:#475569;line-height:1.6;"><strong>Include project descriptions.</strong> AI matches on context — a project description mentioning NLP, React, or AWS extends your keyword coverage significantly.</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;font-size:15px;">✅</td><td style="padding:6px 0 6px 8px;font-size:13px;color:#475569;line-height:1.6;"><strong>Act on high-score items first.</strong> Sort by score and apply to 80%+ matches before checking lower-scored ones.</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;font-size:15px;">✅</td><td style="padding:6px 0 6px 8px;font-size:13px;color:#475569;line-height:1.6;"><strong>Use Browse when you don't match.</strong> If your profile is new and matches are low, Browse lets you see everything and apply directly.</td></tr>
    </table>
  </div>

  <!-- CTA -->
  <div style="background:#4f46e5;padding:32px 40px;text-align:center;">
    <h2 style="margin:0 0 10px;color:#fff;font-size:18px;font-weight:800;">Ready to find your next opportunity?</h2>
    <p style="margin:0 0 22px;color:rgba(255,255,255,0.8);font-size:14px;">Start by uploading your CV or filling in your profile.</p>
    <a href="{settings.app_url}/profile" style="display:inline-block;background:#fff;color:#4f46e5;font-weight:800;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;letter-spacing:-.01em;">Go to My Profile →</a>
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.7;">
      Opportunity Finder &bull; AI-Powered Career Discovery<br>
      You received this because you just created an account. Questions? Reply to this email.
    </p>
  </div>

</div>
</body>
</html>"""
    await send_email_with_attachment(
        to_email=to_email,
        subject=f"Welcome to Opportunity Finder, {display_name}! Here's your complete guide",
        text_content=plain,
        html_content=html,
    )


async def send_password_reset_email(to_email: str, token: str):
    """Send a 6-digit password reset code."""
    plain = (
        f"Your Opportunity Finder password reset code is: {token}\n"
        "This code expires in 15 minutes. If you did not request a reset, ignore this email."
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:48px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#d97706 0%,#b45309 100%);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Reset your password</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Opportunity Finder</p>
    </div>
    <div style="background:#fff;padding:36px 40px;text-align:center;">
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        Use the code below to reset your password. It expires in <strong>15 minutes</strong>.
      </p>
      <div style="display:inline-block;background:#fffbeb;border:2px dashed #d97706;border-radius:12px;padding:18px 40px;">
        <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#b45309;">{token}</span>
      </div>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Opportunity Finder &bull; Never share this code with anyone.</p>
    </div>
  </div>
</body>
</html>"""
    await send_email_with_attachment(
        to_email=to_email,
        subject="Your password reset code",
        text_content=plain,
        html_content=html,
    )


def _score_badge(score: int) -> str:
    if score >= 80:
        color, bg = "#166534", "#dcfce7"
    elif score >= 50:
        color, bg = "#92400e", "#fef3c7"
    else:
        color, bg = "#991b1b", "#fee2e2"
    return (
        f'<span style="display:inline-block;padding:3px 9px;border-radius:999px;'
        f'font-weight:700;font-size:12px;background:{bg};color:{color};">'
        f'{score}%</span>'
    )

def _type_badge(type_str: str) -> str:
    colors = {
        "job": "#6d28d9",
        "scholarship": "#0369a1",
        "fellowship": "#be185d",
        "grant": "#065f46",
        "internship": "#b45309",
    }
    key = (type_str or "").lower()
    color = colors.get(key, "#374151")
    return (
        f'<span style="display:inline-block;padding:2px 8px;border-radius:4px;'
        f'font-size:11px;font-weight:600;background:{color}22;color:{color};'
        f'text-transform:capitalize;">{type_str or "—"}</span>'
    )

def generate_digest_html(name: str, opportunities_with_scores: list, email: str = "") -> str:
    date_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    count = len(opportunities_with_scores)

    rows_html = ""
    for i, (opp, score) in enumerate(opportunities_with_scores):
        bg = "#ffffff" if i % 2 == 0 else "#f9fafb"
        deadline = opp.deadline.strftime("%b %d, %Y") if opp.deadline else "—"
        title = (opp.title or "")[:60] + ("…" if len(opp.title or "") > 60 else "")
        org = opp.organization or "—"
        rows_html += f"""
        <tr style="background:{bg};">
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">{_score_badge(score)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{_type_badge(opp.type)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;max-width:260px;">{title}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">{org}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:#6b7280;">{deadline}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <a href="{opp.url}" target="_blank"
               style="display:inline-block;padding:5px 14px;background:#6d28d9;color:#fff;
                      border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
              Apply
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:860px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:36px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
        Your Daily Top {count} Job Matches
      </h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">{date_str}</p>
    </div>

    <!-- Greeting -->
    <div style="background:#fff;padding:28px 40px 20px;">
      <p style="margin:0;font-size:15px;color:#111827;">Hello <strong>{name}</strong>,</p>
      <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
        Here are your top AI-matched opportunities for today based on your CV profile.
        The full list with all details is attached as an Excel file.
      </p>
    </div>

    <!-- Table -->
    <div style="background:#fff;padding:0 40px 32px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Score</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Type</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Title</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Organization</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Deadline</th>
            <th style="padding:10px 14px;text-align:center;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Link</th>
          </tr>
        </thead>
        <tbody>{rows_html}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Opportunity Finder &bull; Scores are based on keyword relevance to your uploaded CV.
        <br>Update your CV on your profile page to improve match accuracy.
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:#cbd5e1;">
        <a href="{_unsub_url(email, 'digest')}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from daily digest</a>
        &nbsp;&bull;&nbsp;
        <a href="{_unsub_url(email, 'all')}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from all emails</a>
        &nbsp;&bull;&nbsp;
        <a href="{settings.app_url}/profile" style="color:#94a3b8;text-decoration:underline;">Manage preferences</a>
      </p>
    </div>

  </div>
</body>
</html>"""


def generate_deadline_alert_html(name: str, alert_opps: list, email: str = "") -> str:
    rows_html = ""
    for i, (opp, score) in enumerate(alert_opps):
        bg = "#ffffff" if i % 2 == 0 else "#f9fafb"
        deadline = opp.deadline.strftime("%b %d, %Y") if opp.deadline else "—"
        title = (opp.title or "")[:60] + ("…" if len(opp.title or "") > 60 else "")
        rows_html += f"""
        <tr style="background:{bg};">
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">{_score_badge(score)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;">{_type_badge(opp.type)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;max-width:260px;">{title}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#374151;">{opp.organization or '—'}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">
            <span style="font-weight:700;color:#dc2626;">{deadline}</span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;">
            <a href="{opp.url}" target="_blank"
               style="display:inline-block;padding:5px 14px;background:#dc2626;color:#fff;
                      border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
              Apply Now
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:860px;margin:32px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:36px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
        &#9888; Deadline Alert
      </h1>
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
        These opportunities expire within 48 hours
      </p>
    </div>

    <!-- Greeting -->
    <div style="background:#fff;padding:28px 40px 20px;">
      <p style="margin:0;font-size:15px;color:#111827;">Hello <strong>{name}</strong>,</p>
      <p style="margin:10px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
        The following opportunities match your profile and are closing very soon.
        Don't miss out — apply before the deadline!
      </p>
    </div>

    <!-- Table -->
    <div style="background:#fff;padding:0 40px 32px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#fef2f2;border-top:1px solid #fecaca;border-bottom:2px solid #fecaca;">
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Score</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Type</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Title</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Organization</th>
            <th style="padding:10px 14px;text-align:left;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Deadline</th>
            <th style="padding:10px 14px;text-align:center;font-weight:700;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:.05em;">Link</th>
          </tr>
        </thead>
        <tbody>{rows_html}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#fef2f2;padding:20px 40px;border-top:1px solid #fecaca;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Opportunity Finder &bull; You received this because these opportunities match your CV and expire within 48 hours.
      </p>
      <p style="margin:10px 0 0;font-size:11px;color:#cbd5e1;">
        <a href="{_unsub_url(email, 'alerts')}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from deadline alerts</a>
        &nbsp;&bull;&nbsp;
        <a href="{_unsub_url(email, 'all')}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from all emails</a>
        &nbsp;&bull;&nbsp;
        <a href="{settings.app_url}/profile" style="color:#94a3b8;text-decoration:underline;">Manage preferences</a>
      </p>
    </div>

  </div>
</body>
</html>"""


async def run_daily_opportunity_digests():
    """Runs daily at 6:00 AM to send top 20 latest matching opportunities."""
    logger.info("Running daily opportunity digests...")
    async with async_session() as session:
        # Fetch all users
        stmt = select(User)
        users = (await session.execute(stmt)).scalars().all()

        for user in users:
            if not user.email_digest_enabled:
                continue
            if not user.parsed_cv:
                continue

            keywords = user.parsed_cv.get("job_keywords", [])[:15]
            if not keywords:
                continue

            keyword_filters = [
                Opportunity.search_tsv.op("@@")(func.plainto_tsquery("simple", kw))
                for kw in keywords
            ]
            
            combined_keywords = " OR ".join([f'"{kw}"' for kw in keywords])
            ts_query = func.websearch_to_tsquery("simple", combined_keywords)
            rank_col = func.ts_rank(Opportunity.search_tsv, ts_query).label("rank")

            # Get Top 20 latest opportunities matching their keywords
            stmt = (
                select(Opportunity, rank_col)
                .where(Opportunity.is_active.is_(True))
                .where(or_(*keyword_filters))
                .order_by(Opportunity.posted_at.desc().nullslast(), rank_col.desc())
                .limit(20)
            )
            db_rows = (await session.execute(stmt)).all()
            
            if not db_rows:
                continue
                
            all_ranks = [r[1] for r in db_rows]
            max_rank = max(all_ranks) if all_ranks else 1.0
            if max_rank <= 0.0:
                max_rank = 1.0
                
            # List of tuples (Opportunity, Match Score)
            opportunities_with_scores = []
            for row, rank in db_rows:
                score = int((rank / max_rank) * 100)
                opportunities_with_scores.append((row, score))
            
            # Sort locally by match score desc to ensure best matches at top of excel
            opportunities_with_scores.sort(key=lambda x: x[1], reverse=True)

            excel_bytes = generate_excel_attachment(opportunities_with_scores)
            name = user.full_name or user.email
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

            subject = f"Your Daily Top {len(opportunities_with_scores)} AI Job Matches"
            plain_body = (
                f"Hello {name},\n\n"
                f"Here are your top {len(opportunities_with_scores)} AI-matched opportunities for today.\n"
                "The full list is attached as an Excel file.\n\n"
                + "\n".join(
                    f"[{score}%] {opp.title} — {opp.organization or ''} | Deadline: {opp.deadline.strftime('%Y-%m-%d') if opp.deadline else 'N/A'} | {opp.url}"
                    for opp, score in opportunities_with_scores
                )
                + "\n\nBest,\nOpportunity Finder Team"
            )
            html_body = generate_digest_html(name, opportunities_with_scores, email=user.email)

            await send_email_with_attachment(
                to_email=user.email,
                subject=subject,
                text_content=plain_body,
                html_content=html_body,
                attachment_name=f"opportunity_digest_{date_str}.xlsx",
                attachment_bytes=excel_bytes,
                user_id=user.id,
                email_type="daily_digest"
            )

async def run_deadline_alerts():
    """Runs to alert users of opportunities expiring in the next 48 hours."""
    logger.info("Running deadline alerts...")
    async with async_session() as session:
        now = datetime.now(timezone.utc)
        soon = now + timedelta(hours=48)
        
        # 1. Fetch opportunities expiring between now and 48 hours
        stmt = (
            select(Opportunity)
            .where(Opportunity.is_active.is_(True))
            .where(Opportunity.deadline != None)
            .where(Opportunity.deadline >= now.date())
            .where(Opportunity.deadline <= soon.date())
        )
        expiring_opps = (await session.execute(stmt)).scalars().all()
        
        if not expiring_opps:
            return
            
        # 2. Fetch all users
        user_stmt = select(User)
        users = (await session.execute(user_stmt)).scalars().all()
        
        for user in users:
            if not user.email_alerts_enabled:
                continue
            if not user.parsed_cv:
                continue

            keywords = user.parsed_cv.get("job_keywords", [])[:15]
            if not keywords:
                continue

            keyword_filters = [
                Opportunity.search_tsv.op("@@")(func.plainto_tsquery("simple", kw))
                for kw in keywords
            ]
            
            combined_keywords = " OR ".join([f'"{kw}"' for kw in keywords])
            ts_query = func.websearch_to_tsquery("simple", combined_keywords)
            rank_col = func.ts_rank(Opportunity.search_tsv, ts_query).label("rank")
            
            # Re-rank expiring opps against THIS user's keywords
            expiring_ids = [o.id for o in expiring_opps]
            rank_stmt = (
                select(Opportunity, rank_col)
                .where(Opportunity.id.in_(expiring_ids))
                .where(or_(*keyword_filters))
            )
            ranked_db_rows = (await session.execute(rank_stmt)).all()
            
            if not ranked_db_rows:
                continue
                
            # Let's run a quick query to get their max rank for ANY opportunity so the scale (0-100) matches standard search.
            max_rank_stmt = select(func.max(rank_col)).where(or_(*keyword_filters))
            max_rank_result = (await session.execute(max_rank_stmt)).scalar()
            max_rank = max_rank_result if max_rank_result and max_rank_result > 0 else 1.0
            
            alert_opps = []
            for row, rank in ranked_db_rows:
                score = int((rank / max_rank) * 100)
                if score >= 50:
                    alert_opps.append((row, score))
                    
            if alert_opps:
                alert_opps.sort(key=lambda x: x[1], reverse=True)
                name = user.full_name or user.email

                plain_lines = [
                    f"Hello {name},\n",
                    "The following opportunities matching your profile are expiring within 48 hours:\n",
                ]
                for opp, score in alert_opps:
                    plain_lines.append(f"- [{score}%] {opp.title} at {opp.organization}. Deadline: {opp.deadline.strftime('%Y-%m-%d')}")
                    plain_lines.append(f"  Link: {opp.url}\n")
                plain_lines.append("\nBest,\nOpportunity Finder Team")

                await send_email_with_attachment(
                    to_email=user.email,
                    subject="Action Required: Highly Matched Opportunities Expiring Soon",
                    text_content="\n".join(plain_lines),
                    html_content=generate_deadline_alert_html(name, alert_opps, email=user.email),
                    user_id=user.id,
                    email_type="deadline_alert"
                )
