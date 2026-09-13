export const isFinalMinute = (remaining) => Number.isInteger(remaining) && remaining > 0 && remaining <= 60;
export const didTimerFinish = (previous, next) => Number(previous) > 0 && Number(next) === 0;
export const isNaturalCountdownCompletion = ({ hadDeadline, previous, next }) => Boolean(hadDeadline) && didTimerFinish(previous, next);
export const getFullscreenTimerHeading = (mode) => mode === 'countdown' ? 'Countdown' : 'Aktuelle Uhrzeit';
export const completionMessage = 'Die Zeit ist aus';
export const isFullscreenCompletion = ({ nativeFullscreen, completionCelebration }) => Boolean(nativeFullscreen) && Boolean(completionCelebration);
