/**
 * Web Audio API Audio Processor for StreamVault Video Player
 * Provides Dynamic Range Compression (Night Mode / Dialogue Enhancement)
 * and Channel Analysis.
 */

export class StreamVaultAudioProcessor {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private isNormalized: boolean = false;
  private initialized: boolean = false;

  public initialize(videoElement: HTMLVideoElement): boolean {
    if (this.initialized || typeof window === "undefined") return true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return false;

      this.audioCtx = new AudioContextClass();
      this.sourceNode = this.audioCtx.createMediaElementSource(videoElement);
      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.gainNode = this.audioCtx.createGain();

      // Configure Netflix-grade Night Mode / Dialogue Clarity Compressor:
      // Threshold: -24dB (compresses loud sound effects/explosions)
      // Knee: 30dB (smooth transition)
      // Ratio: 12 (strong compression on explosions)
      // Attack: 0.003s (rapid suppression of sudden loud peaks)
      // Release: 0.25s (smooth return to dialogue levels)
      this.compressorNode.threshold.setValueAtTime(-24, this.audioCtx.currentTime);
      this.compressorNode.knee.setValueAtTime(30, this.audioCtx.currentTime);
      this.compressorNode.ratio.setValueAtTime(12, this.audioCtx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.audioCtx.currentTime);

      // Default: Direct Pass-through to destination
      this.sourceNode.connect(this.audioCtx.destination);
      this.initialized = true;
      return true;
    } catch (err) {
      console.warn("[AudioProcessor] Web Audio API init skipped or already hooked:", err);
      return false;
    }
  }

  public setAudioNormalization(enabled: boolean) {
    if (!this.initialized || !this.audioCtx || !this.sourceNode || !this.compressorNode || !this.gainNode) {
      this.isNormalized = enabled;
      return;
    }

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    try {
      // Disconnect all current routing
      this.sourceNode.disconnect();
      this.compressorNode.disconnect();
      this.gainNode.disconnect();

      if (enabled) {
        // Route through compressor -> slight gain boost for whisper dialogue -> destination
        this.gainNode.gain.setValueAtTime(1.15, this.audioCtx.currentTime);
        this.sourceNode.connect(this.compressorNode);
        this.compressorNode.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
      } else {
        // Direct pass-through
        this.sourceNode.connect(this.audioCtx.destination);
      }
      this.isNormalized = enabled;
    } catch (err) {
      console.warn("[AudioProcessor] Error switching normalization:", err);
    }
  }

  public getNormalizationState(): boolean {
    return this.isNormalized;
  }

  public dispose() {
    try {
      if (this.sourceNode) this.sourceNode.disconnect();
      if (this.compressorNode) this.compressorNode.disconnect();
      if (this.gainNode) this.gainNode.disconnect();
      if (this.audioCtx && this.audioCtx.state !== "closed") {
        this.audioCtx.close().catch(() => {});
      }
    } catch {
      // cleanup safe
    }
    this.audioCtx = null;
    this.sourceNode = null;
    this.compressorNode = null;
    this.gainNode = null;
    this.initialized = false;
  }
}
