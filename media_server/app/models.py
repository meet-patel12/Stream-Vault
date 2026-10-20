from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class EncodingJob(Base):
    __tablename__ = "encoding_jobs"

    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey("content.id", ondelete="SET NULL"), nullable=True)
    source_file = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="pending", index=True)
    progress = Column(Integer, nullable=False, default=0)
    dash_manifest = Column(Text, nullable=True)
    hls_manifest = Column(Text, nullable=True)
    vmaf_scores = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
