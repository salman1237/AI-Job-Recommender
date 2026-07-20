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
        f"Your AI Job Recommender verification code is: {otp}\n"
        "This code expires in 10 minutes. Do not share it with anyone."
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:48px auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Verify your email</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">AI Job Recommender</p>
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
      <p style="margin:0;font-size:11px;color:#9ca3af;">AI Job Recommender &bull; Do not share this code with anyone.</p>
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

def generate_digest_html(name: str, opportunities_with_scores: list) -> str:
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
        AI Job Recommender &bull; Scores are based on keyword relevance to your uploaded CV.
        <br>Update your CV on your profile page to improve match accuracy.
      </p>
    </div>

  </div>
</body>
</html>"""


def generate_deadline_alert_html(name: str, alert_opps: list) -> str:
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
        AI Job Recommender &bull; You received this because these opportunities match your CV and expire within 48 hours.
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
                + "\n\nBest,\nAI Job Recommender Team"
            )
            html_body = generate_digest_html(name, opportunities_with_scores)

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
                plain_lines.append("\nBest,\nAI Job Recommender Team")

                await send_email_with_attachment(
                    to_email=user.email,
                    subject="Action Required: Highly Matched Opportunities Expiring Soon",
                    text_content="\n".join(plain_lines),
                    html_content=generate_deadline_alert_html(name, alert_opps),
                    user_id=user.id,
                    email_type="deadline_alert"
                )
