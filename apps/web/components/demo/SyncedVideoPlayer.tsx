"use client";

import { useRef, useEffect } from "react";

/**
 * Video playback synced across teacher/students during a live class demo.
 * Teacher uses native browser controls (play/pause/seek) and reports state
 * up via callbacks; students get a controls-less <video> that reconciles
 * itself to `videoTime`/`videoPlaying` whenever they change.
 */
export function SyncedVideoPlayer({
  url, isTeacher, videoTime, videoPlaying,
  onTimeChange, onPlayingChange,
}: {
  url: string;
  isTeacher: boolean;
  videoTime: number;
  videoPlaying: boolean;
  onTimeChange?: (time: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Student: snap to the teacher's position when it drifts by more than 1s.
  useEffect(() => {
    if (isTeacher || !videoRef.current) return;
    const diff = Math.abs(videoRef.current.currentTime - videoTime);
    if (diff > 1) videoRef.current.currentTime = videoTime;
  }, [videoTime, isTeacher]);

  // Student: mirror play/pause.
  useEffect(() => {
    if (isTeacher || !videoRef.current) return;
    if (videoPlaying && videoRef.current.paused) {
      videoRef.current.play().catch(() => null);
    } else if (!videoPlaying && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [videoPlaying, isTeacher]);

  return (
    <div className="flex h-full items-center justify-center bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={url}
        controls={isTeacher}
        className="max-h-full max-w-full"
        // onTimeChange fires continuously while playing — the caller
        // (teacher component) throttles it to ~500ms before writing to the
        // DB, per Prompt 11.6 Part 5.
        onTimeUpdate={isTeacher ? (e) => onTimeChange?.((e.target as HTMLVideoElement).currentTime) : undefined}
        onPlay={isTeacher ? () => onPlayingChange?.(true) : undefined}
        onPause={isTeacher ? () => onPlayingChange?.(false) : undefined}
        onSeeked={isTeacher ? (e) => onTimeChange?.((e.target as HTMLVideoElement).currentTime) : undefined}
      />
      {/* Student: no controls at all — video-only. */}
    </div>
  );
}
