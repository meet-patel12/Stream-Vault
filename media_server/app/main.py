import os
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
try:
    from media_server.app.models import Base, EncodingJob
    from media_server.app.worker import process_encoding_job
    from media_server.pipeline.config import SUPPORTED_CONTAINERS
except ImportError:
    from .models import Base, EncodingJob
    from .worker import process_encoding_job
    from pipeline.config import SUPPORTED_CONTAINERS

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/netflix")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

UPLOAD_DIR = Path("uploads/sources")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="StreamVault Media & Admin Server", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/api/v1/admin/health")
def health_check():
    return {"status": "healthy", "service": "media-admin-server"}

@app.post("/api/v1/admin/upload")
async def upload_source_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    content_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in SUPPORTED_CONTAINERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format {ext}. Allowed: {list(SUPPORTED_CONTAINERS)}",
        )

    file_path = UPLOAD_DIR / f"{int(os.times().system * 1000)}_{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    job = EncodingJob(
        content_id=content_id,
        source_file=str(file_path.resolve()),
        status="pending",
        progress=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(process_encoding_job, db, job.id)
    return {"message": "Upload successful, transcoding queued", "job_id": job.id, "status": job.status}

@app.get("/api/v1/admin/jobs")
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(EncodingJob).order_by(EncodingJob.created_at.desc()).all()
    return [{"id": j.id, "content_id": j.content_id, "status": j.status, "progress": j.progress, "created_at": j.created_at} for j in jobs]

@app.get("/api/v1/admin/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(EncodingJob).filter(EncodingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/api/v1/admin/jobs/{job_id}/retry")
def retry_job(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job = db.query(EncodingJob).filter(EncodingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == "processing":
        raise HTTPException(status_code=400, detail="Job is currently processing")

    job.status = "pending"
    job.progress = 0
    job.error_message = None
    db.commit()

    background_tasks.add_task(process_encoding_job, db, job.id)
    return {"message": f"Job {job_id} retrying queued"}

@app.get("/api/v1/admin/stats")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(EncodingJob).count()
    completed = db.query(EncodingJob).filter(EncodingJob.status == "completed").count()
    failed = db.query(EncodingJob).filter(EncodingJob.status == "failed").count()
    processing = db.query(EncodingJob).filter(EncodingJob.status == "processing").count()
    pending = db.query(EncodingJob).filter(EncodingJob.status == "pending").count()
    return {
        "total_jobs": total,
        "completed": completed,
        "failed": failed,
        "processing": processing,
        "pending": pending,
    }
