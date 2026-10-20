import os
import logging
from datetime import datetime
from sqlalchemy.orm import Session
try:
    from media_server.app.models import EncodingJob
    from media_server.pipeline.transcoder import MediaPipeline
except ImportError:
    from .models import EncodingJob
    from pipeline.transcoder import MediaPipeline

logger = logging.getLogger("encoding_worker")

def process_encoding_job(db: Session, job_id: int):
    job = db.query(EncodingJob).filter(EncodingJob.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found.")
        return

    work_dir = os.path.join(os.getcwd(), "public", "stream_assets", str(job.id))
    try:
        job.status = "processing"
        job.progress = 10
        job.updated_at = datetime.utcnow()
        db.commit()

        pipeline = MediaPipeline(work_dir=work_dir)

        job.progress = 25
        db.commit()

        report = pipeline.run(job.source_file)
        manifests = report.get("manifests", {})
        job.dash_manifest = manifests.get("dash_manifest")
        job.hls_manifest = manifests.get("hls_manifest")
        job.vmaf_scores = report.get("vmaf_scores")
        job.progress = 100
        job.status = "completed"
        job.updated_at = datetime.utcnow()

        if job.content_id:
            from sqlalchemy import text
            db.execute(
                text("UPDATE content SET hls_manifest_key = :hls, video_key = :dash, updated_at = NOW() WHERE id = :cid"),
                {"hls": job.hls_manifest, "dash": job.dash_manifest, "cid": job.content_id}
            )

        db.commit()
        pipeline.cleanup_temp_files()
        logger.info(f"Job {job_id} completed and linked successfully.")
    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        job.status = "failed"
        job.error_message = str(e)
        job.updated_at = datetime.utcnow()
        db.commit()
