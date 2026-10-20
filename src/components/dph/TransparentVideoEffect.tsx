import { useEffect, useRef } from 'react';

/** All clips are silent: game events own the original announcement/explosion
 * audio, so a fallback or style change never replays or doubles those sounds. */
export default function TransparentVideoEffect({ onEnded, onUnavailable, src, label }: {
  onEnded: () => void; onUnavailable: () => void; src: string; label: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onEnded, onUnavailable });
  callbacks.current = { onEnded, onUnavailable };
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let active = true;
    let failed = false;
    const fail = () => {
      if (!active || failed) return;
      failed = true; callbacks.current.onUnavailable();
    };
    let watchdog = setTimeout(fail, 6000);
    const progress = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(fail, 4000);
    };
    element.addEventListener('timeupdate', progress);
    element.addEventListener('error', fail);
    void element.play().catch(fail);
    return () => {
      active = false; clearTimeout(watchdog);
      element.removeEventListener('timeupdate', progress);
      element.removeEventListener('error', fail);
      element.pause();
    };
  }, []);
  return <div className="ddz-transparent-play-video" aria-label={label}>
    <video ref={video} src={src} autoPlay muted playsInline preload="auto"
      disablePictureInPicture onEnded={() => callbacks.current.onEnded()} />
  </div>;
}
