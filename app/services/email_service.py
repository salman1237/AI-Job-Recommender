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

async def send_email_with_attachment(to_email: str, subject: str, text_content: str, attachment_name: str = None, attachment_bytes: bytes = None, user_id: int = None, email_type: str = None):
    if not settings.mail_host or not settings.mail_username:
        logger.warning("SMTP not configured. Skipping email to %s", to_email)
        return

    message = EmailMessage()
    message["From"] = f"{settings.mail_from_name} <{settings.mail_from_address}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_content)

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
            
            subject = "Your Daily Top 20 AI Job Matches"
            body = (
                f"Hello {user.full_name or user.email},\n\n"
                "Attached is your daily Excel digest of the top 20 latest opportunities that match your CV profile.\n"
                "Have a great day!\n\n"
                "Best,\nAI Job Recommender Team"
            )
            
            await send_email_with_attachment(
                to_email=user.email,
                subject=subject,
                text_content=body,
                attachment_name=f"opportunity_digest_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.xlsx",
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
                
                body_lines = [f"Hello {user.full_name or user.email},\n", "The following opportunities matching your profile are expiring soon:\n"]
                for opp, score in alert_opps:
                    body_lines.append(f"- {opp.title} at {opp.organization} (Match: {score}%). Deadline: {opp.deadline.strftime('%Y-%m-%d')}")
                    body_lines.append(f"  Link: {opp.url}\n")
                    
                body_lines.append("\nBest,\nAI Job Recommender Team")
                
                await send_email_with_attachment(
                    to_email=user.email,
                    subject="Action Required: Highly Matched Opportunities Expiring Soon",
                    text_content="\n".join(body_lines),
                    user_id=user.id,
                    email_type="deadline_alert"
                )
